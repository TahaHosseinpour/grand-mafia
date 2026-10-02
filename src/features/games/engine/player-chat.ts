import { RAINBOW_XP } from '@/lib/game-constants';
import { chatStaffLabel, isFullStaff } from '@/server/staff';
import { gameChatInput, generalChatInput } from '../inputs';
import { chatReplacements } from './chat-replacements';
import { handleAddNewClaim } from './claim';
import { runCommand } from './commands';
import { getEmoteList } from './emotes';
import { findOnlineUser } from './lists';
import { makeReport } from './report';
import { engineStore } from './store';
import { sendCommandChatsUpdate, sendInProgressGameUpdate, sendPlayerChatUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, Game, PlayerChatLine } from './types';

/** Anything that is only formatting characters («**», «~~»…) is not a message. */
const EMPTY_MARKUP = /^(\*|[*~_]{2,4})$/i;

const generalReplacementTimes = Array(chatReplacements.length + 1).fill(0) as number[];

/** Time since a player's last message, against the leniency for a repeat vs. a new message. */
function sentTooSoon(last: { time?: Date | number; timestamp?: Date | number; chat?: string } | undefined, chat: string, repeatGap: number, newGap: number, now: number): boolean {
  if (!last) return false;
  const gap = last.chat && last.chat.toLowerCase() === chat.toLowerCase() ? repeatGap : newGap;
  const at = Number(last.time ?? last.timestamp ?? 0);
  return now - at < gap * 1000;
}

/**
 * A canned answer: the typed shortcut is replaced by its explanation, subject
 * to per-answer cooldowns, shorter for staff. Returns the text to send, `false`
 * to drop the message (with the player told why), or null when it is not a shortcut.
 */
function applyReplacements(
  socket: HubSocket,
  chat: string,
  times: number[],
  isStaff: boolean,
  gamesPlayed: number
): string | false | null {
  let result: string | null = null;

  for (const repl of chatReplacements) {
    if (!repl.regex.exec(chat)) continue;

    if (isStaff) {
      if (times[repl.id] === 0 || Date.now() > times[repl.id] + repl.aemCooldown * 1000) {
        result = repl.replacement;
        times[repl.id] = times[0] = Date.now();
      } else {
        socket.emit('sendAlert', `تا ${(((times[repl.id] + repl.aemCooldown * 1000) - Date.now()) / 1000).toFixed(0)} ثانیه‌ی دیگر نمی‌توانید این را دوباره بنویسید.`);
        return false;
      }
    } else if (gamesPlayed > repl.normalGames) {
      if (Date.now() > times[0] + 30000 && (times[repl.id] === 0 || Date.now() > times[repl.id] + repl.normalCooldown * 1000)) {
        result = repl.replacement;
        times[repl.id] = times[0] = Date.now();
      } else {
        const wait = Math.max((times[0] + 30000 - Date.now()) / 1000, (times[repl.id] + repl.normalCooldown * 1000 - Date.now()) / 1000);
        socket.emit('sendAlert', `الان نمی‌توانید این کار را بکنید؛ ${wait.toFixed(0)} ثانیه‌ی دیگر تلاش کنید.`);
        return false;
      }
    }
  }
  return result;
}

/** A message in the lobby-wide chat. */
export async function handleNewGeneralChat(socket: HubSocket, caller: Caller, raw: unknown): Promise<void> {
  const parsed = generalChatInput.safeParse(raw);
  if (!parsed.success) return;

  const user = findOnlineUser(caller.username);
  if (!user || user.isPrivate) return;

  const store = engineStore();
  let chat = parsed.data.chat.trim();
  if (chat.length > 300 || !chat.length || EMPTY_MARKUP.test(chat)) return;

  const isStaff = isFullStaff(user.staffRole);
  const now = Date.now();

  const ping = /^@(mod|moderator|editor|aem|mods) (.*)$/i.exec(chat);
  if (ping) {
    if (!store.generalChats.lastModPing || now > store.generalChats.lastModPing + 180000) {
      makeReport({ player: caller.username, situation: `«${ping[2]}».`, homepage: true }, null, 'ping');
      store.generalChats.lastModPing = now;
    } else {
      socket.emit('sendAlert', `برای ${Math.ceil((store.generalChats.lastModPing + 180000 - now) / 1000)} ثانیه‌ی دیگر نمی‌توانید مدیران را فراخوانی کنید.`);
    }
    return;
  }

  if (sentTooSoon(user.lastMessage, chat, 3, 0.5, now)) return;

  const replaced = applyReplacements(socket, chat, generalReplacementTimes, isStaff, user.wins + user.losses);
  if (replaced === false) return;
  if (replaced) chat = replaced;

  // Only players with some experience may talk in the lobby (everyone, in development).
  if (user.xpOverall >= RAINBOW_XP || user.isRainbowOverall || process.env.NODE_ENV !== 'production') {
    const line = {
      time: new Date(now),
      chat,
      userName: caller.username,
      staffRole: chatStaffLabel(user.staffRole) ?? '',
      hiddenUsername: undefined as string | undefined,
    };
    user.lastMessage = { time: now, chat };

    if (isStaff && user.staffIncognito) {
      line.hiddenUsername = line.userName;
      line.staffRole = 'moderator';
      line.userName = 'ناشناس';
    }
    store.generalChats.list.push(line);
    if (store.generalChats.list.length > 99) store.generalChats.list.shift();
    store.hub.emitAll('generalChats', store.generalChats);
  }
}

/** The claim a player's short message stands for («rr», «blue», «ب»…), if they are entitled to one. */
function claimFromMessage(claim: string, chat: string): { claimState: string } | null {
  if (/^[RB]{2,3}$/i.test(chat)) {
    const sorted = chat.toLowerCase().split('').sort().reverse().join('');
    if (chat.length === 3 && claim === 'wasPresident') return { claimState: sorted };
    if (chat.length === 2 && claim === 'wasChancellor') return { claimState: sorted };
    if (chat.length === 3 && claim === 'didPolicyPeek') return { claimState: chat };
  }
  if (claim === 'didSinglePolicyPeek' || claim === 'didInvestigateLoyalty') {
    if (/^(b|blue|l|lib|liberal|آبی|ل|لیبرال)$/i.test(chat)) return { claimState: 'liberal' };
    if (/^(r|red|fas|f|fasc|fascist|قرمز|ف|فاشیست)$/i.test(chat)) return { claimState: 'fascist' };
  }
  return null;
}

/** A message in a game's chat: a player, an observer or staff. */
export async function handleAddNewGameChat(socket: HubSocket, caller: Caller, raw: unknown, game: Game | undefined): Promise<void> {
  const parsed = gameChatInput.safeParse(raw);
  if (!parsed.success || !game?.general) return;
  const data = parsed.data;

  const chat = data.chat.trim();
  if (chat.length > 300 || !chat.length || EMPTY_MARKUP.test(data.chat)) return;

  const { publicPlayersState } = game;
  const playerIndex = publicPlayersState.findIndex((player) => player.userName === caller.username);
  const player = publicPlayersState[playerIndex];
  const user = findOnlineUser(caller.username);
  if (!user?.userName) return;

  const isStaff = isFullStaff(user.staffRole);

  // A short message that is a claim is recorded as one.
  const seat = game.private?.seatedPlayers?.[playerIndex];
  const standing = seat?.playersState?.[playerIndex]?.claim;
  if (standing) {
    const claim = claimFromMessage(standing, chat);
    if (claim && handleAddNewClaim(socket, caller, game, { claim: standing, claimState: claim.claimState })) return;
  }

  if (!isStaff && !player) {
    // Observers: private games only for the whitelisted, and a little XP first.
    if (game.general.private && !game.general.whitelistedPlayers.includes(caller.username)) return;
    if (user.xpOverall < RAINBOW_XP && !user.isRainbowOverall) return;
  }

  const { gameState } = game;
  const status = player?.governmentStatus;
  // The government may not talk while choosing policies in secret.
  if (player && (gameState.phase === 'presidentSelectingPolicy' || gameState.phase === 'chancellorSelectingPolicy') && (status === 'isPresident' || status === 'isChancellor')) {
    return;
  }

  const now = Date.now();
  if (!isStaff && sentTooSoon(user.lastMessage, chat, 1.5, 0.25, now)) return;
  // Stops command spamming.
  user.lastMessage = { timestamp: now };

  if (chat.startsWith('/')) return runCommand(socket, user, game, chat, isStaff, Boolean(player));

  const ping = /^@(mod|moderator|editor|aem|mods) (.*)$/i.exec(chat);
  if (ping) return runCommand(socket, user, game, `/pingmod ${ping[2]}`, isStaff, Boolean(player));

  if (player && ((player.isDead && !game.gameState.isCompleted) || player.leftGame)) return;

  const replaced = applyReplacements(socket, chat, game.general.chatReplTime, isStaff, user.wins + user.losses);
  if (replaced === false) return;

  const pinged = /^Ping(\d{1,2})/i.exec(chat);
  if (pinged && player && game.gameState.isStarted) return runCommand(socket, user, game, `/ping ${pinged[1]}`, isStaff, true);

  const cannotChat =
    (game.gameState.isStarted && !game.gameState.isCompleted && player && game.general.playerChats === 'disabled') ||
    (!isStaff &&
      ((game.gameState.isStarted && !game.gameState.isCompleted && !player && game.general.disableObserver) ||
        (!player && game.general.disableObserverLobby)));
  if (cannotChat) {
    (game.private.commandChats[user.userName] ??= []).push({
      gameChat: true,
      timestamp: Date.now(),
      chat: [{ text: player ? 'چت در این بازی غیرفعال است.' : 'چت تماشاگران در این بازی غیرفعال است.' }],
    });
    sendInProgressGameUpdate(game);
    return;
  }

  const line: PlayerChatLine & Record<string, unknown> = {
    chat: replaced || chat,
    userName: caller.username,
    timestamp: new Date(now),
    staffRole: chatStaffLabel(user.staffRole),
    uid: data.uid,
  };
  if (isStaff && user.staffIncognito) {
    line.hiddenUsername = line.userName;
    line.staffRole = 'moderator';
    line.userName = 'ناشناس';
  }

  // Keeps big private games from using too much memory.
  if (game.general.private && game.chats.length >= 30) game.chats = game.chats.slice(-30);

  if (!game.gameState.isCompleted && game.gameState.isStarted && game.general.playerChats === 'emotes' && !(isStaff && playerIndex === -1)) {
    const emotes = Object.keys(getEmoteList());
    // Emote-only games: only valid :emotes: and digits survive.
    const cleaned = String(line.chat)
      .toLowerCase()
      .split(/(:[a-z]*?:)/g)
      .map((block) => {
        if (block.length <= 2 || !block.startsWith(':') || !block.endsWith(':')) return block.replace(/[^0-9]/g, '');
        return emotes.includes(block) ? ` ${block} ` : '';
      })
      .join('');
    if (!cleaned.length) return;
    line.chat = cleaned;
  }

  game.chats.push(line);
  user.lastMessage = { timestamp: now, chat: String(line.chat) };

  if (game.gameState.isTracksFlipped) sendPlayerChatUpdate(game, line);
  else sendCommandChatsUpdate(game);

}
