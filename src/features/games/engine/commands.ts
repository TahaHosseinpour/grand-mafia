import { findStaffAmongForRealtime } from '@/features/users';
import { line, typed } from './chat';
import { LineGuess } from './line-guess';
import { gameReportHeader, makeReport } from './report';
import { getHub } from './store';
import { sendCommandChatsUpdate, sendInProgressGameUpdate } from './updates';
import type { HubSocket } from './hub';
import type { OnlineUser } from './store';
import type { Game } from './types';

/**
 * Slash commands typed in a game's chat (legacy `commands.js`). Replies are
 * private: they go to `commandChats[user]` and only that player sees them.
 * Moderator-only commands (/forcevote, /forcepick…) belong to the moderation
 * feature and are registered there.
 */

export type CommandContext = {
  socket: HubSocket;
  user: OnlineUser;
  game: Game;
  args: string[];
  isStaff: boolean;
  isSeated: boolean;
};

export type Command = {
  name: string[];
  description: string;
  examples: string[];
  argumentsFormat: RegExp;
  staffOnly: boolean;
  observerOnly: boolean;
  seatedOnly: boolean;
  gameStartedOnly: boolean;
  run: (context: CommandContext) => void | Promise<void>;
};

const registry: Command[] = [];

/** Adds a command; later features register their own. */
export function registerCommand(command: Command): void {
  registry.push(command);
}

const reply = (game: Game, user: OnlineUser, text: string, date: Date | number = new Date()): void => {
  (game.private.commandChats[user.userName] ??= []).push({ gameChat: true, timestamp: date, chat: [{ text }] });
};

const findCommand = (name: string): Command | null => registry.find((command) => command.name.includes(name.toLowerCase())) ?? null;

function parseCommand(message: string) {
  const match = /^\/([\w؀-ۿ]*)/.exec(message.trim());
  const name = match?.[1] ?? '';
  const command = findCommand(name);
  if (!command || !match) return { name, args: null, command: null };

  const rest = message.trim().slice(match[0].length).trim();
  const parsed = command.argumentsFormat.exec(rest);
  return { name: name.toLowerCase(), args: parsed ? parsed.slice(1) : null, command };
}

/** Runs a message that starts with «/». Always ends by sending the player their reply. */
export async function runCommand(
  socket: HubSocket,
  user: OnlineUser,
  game: Game,
  message: string,
  isStaff: boolean,
  isSeated: boolean
): Promise<void> {
  try {
    game.private.commandChats[user.userName] ??= [];
    const { name, command, args } = parseCommand(message);

    if (!command) return void reply(game, user, `دستور /${name} ناشناخته است. برای دیدن فهرست دستورها /help را بزنید.`);
    if (command.staffOnly && !isStaff) return void reply(game, user, 'شما اجازه‌ی استفاده از این دستور را ندارید.');
    if (command.observerOnly && isSeated) return void reply(game, user, 'بازیکنان روی صندلی نمی‌توانند از این دستور استفاده کنند.');
    if (command.seatedOnly && !isSeated) return void reply(game, user, 'تماشاگران نمی‌توانند از این دستور استفاده کنند.');
    if (command.gameStartedOnly && (!game.gameState.isStarted || game.gameState.isCompleted)) {
      return void reply(game, user, 'این دستور فقط در بازیِ در جریان قابل استفاده است.');
    }
    if (!args) return void reply(game, user, `درست استفاده نکردید. نمونه‌ها: ${command.examples.join('، ')}`);

    await command.run({ socket, user, game, args, isStaff, isSeated });
  } finally {
    if (game.gameState.isTracksFlipped) sendInProgressGameUpdate(game, false);
    else sendCommandChatsUpdate(game);
  }
}

/* ------------------------------------------------------------------ *
 * Commands every player has
 * ------------------------------------------------------------------ */

registerCommand({
  name: ['help', 'راهنما'],
  description: 'فهرست دستورها',
  examples: ['/help'],
  argumentsFormat: /.*/,
  staffOnly: false,
  observerOnly: false,
  seatedOnly: false,
  gameStartedOnly: false,
  run: ({ game, user, isStaff, isSeated }) => {
    let i = 1;
    reply(game, user, 'فهرست دستورها:');
    for (const command of registry) {
      const unusable =
        (command.staffOnly && !isStaff) ||
        (command.observerOnly && isSeated) ||
        (command.seatedOnly && !isSeated) ||
        (command.gameStartedOnly && (!game.gameState.isStarted || game.gameState.isCompleted));
      if (unusable) continue;
      game.private.commandChats[user.userName].push({
        gameChat: true,
        timestamp: Date.now() + i++,
        chat: [typed('player', `/${command.name[0]}`), { text: ` - ${command.description}` }],
      });
    }
  },
});

registerCommand({
  name: ['g', 'gl', 'guessline', 'guesslines', 'guesslimes', 'حدس'],
  description: 'ثبت حدس خط فاشیست‌ها',
  examples: ['/g 123', '/g 56h7', '/g 7890h'],
  argumentsFormat: /^((?:\dh?)+)$/i,
  staffOnly: false,
  observerOnly: true,
  seatedOnly: false,
  gameStartedOnly: true,
  run: ({ game, user, args }) => {
    if (game.general.private || game.customGameSettings?.enabled) {
      return reply(game, user, 'حدس خط فقط در بازی‌های رتبه‌ای و تمرینی فعال است.');
    }
    if (game.trackState.fascistPolicyCount >= 3 && !['specialElection', 'deckPeek'].includes(game.gameState.phase ?? '')) {
      return reply(game, user, 'منطقه‌ی هیتلر شروع شده و حدس خط بسته شده است.');
    }

    const guess = LineGuess.parse(args[0]);
    const playerCount = game.private.seatedPlayers.length;
    const fascistCount = Math.trunc((playerCount - 1) / 2);

    if (!guess) return reply(game, user, 'حدس نامعتبر است. نمونه‌های درست: 12h3 یا 567.');
    if (guess.regs.length !== fascistCount) return reply(game, user, 'تعداد فاشیست‌ها در حدس درست نیست.');
    if (guess.regs.some((seat) => seat > playerCount)) return reply(game, user, 'شماره‌ی صندلی نامعتبر است.');

    reply(game, user, `${game.guesses[user.userName] ? 'حدس خط به‌روز شد.' : 'حدس خط ثبت شد.'} (${guess.toString()})`);
    game.guesses[user.userName] = guess;
  },
});

registerCommand({
  name: ['gm', 'guessmerlin', 'حدس_مرلین'],
  description: 'ثبت حدس مرلین',
  examples: ['/gm 1'],
  argumentsFormat: /^(\d+)$/i,
  staffOnly: false,
  observerOnly: true,
  seatedOnly: false,
  gameStartedOnly: true,
  run: ({ game, user, args }) => {
    if (!game.general.avalonSH) return reply(game, user, 'حدس مرلین فقط در بازی‌های آوالون فعال است.');

    const guess = Number.parseInt(args[0], 10);
    if (!guess || guess < 1 || guess > game.private.seatedPlayers.length) return reply(game, user, 'حدس مرلین نامعتبر است.');

    reply(game, user, `${game.merlinGuesses[user.userName] ? 'حدس مرلین به‌روز شد.' : 'حدس مرلین ثبت شد.'} (${guess})`);
    game.merlinGuesses[user.userName] = guess;
  },
});

registerCommand({
  name: ['pingmod', 'pingmods', 'pingmoderator', 'pingaem', 'pingeditor', 'گزارش_مدیر'],
  description: 'فراخوانی یک مدیر همراه با پیام',
  examples: ['/pingmod کمک کنید'],
  argumentsFormat: /(.*)/,
  staffOnly: false,
  observerOnly: false,
  seatedOnly: true,
  gameStartedOnly: false,
  run: async ({ game, user, args }) => {
    const { general } = game;
    if (general.lastModPing && Date.now() <= general.lastModPing + 180000) {
      return reply(game, user, `برای ${Math.ceil((general.lastModPing + 180000 - Date.now()) / 1000)} ثانیه‌ی دیگر نمی‌توانید مدیر را فراخوانی کنید.`);
    }

    const staffInGame = await findStaffAmongForRealtime(game.publicPlayersState.map((player) => player.userName));
    general.lastModPing = Date.now(); // also stops repeated lookups
    if (staffInGame.length) {
      reply(
        game,
        user,
        'حساب یکی از مدیران یا مدیران آزمایشی در این بازی است. لطفاً از دکمه‌ی گزارش همین بازی استفاده کنید، اطلاعات حساس را لو ندهید، یا مستقیم به مدیر دیگری پیام دهید.'
      );
    } else {
      reply(game, user, 'مدیر با موفقیت فراخوانی شد.');
      makeReport({ player: user.userName, situation: `«${args[0]}».`, ...gameReportHeader(game) }, game, 'ping');
    }
  },
});

registerCommand({
  name: ['ping', 'پینگ'],
  description: 'فراخوانی یک بازیکن',
  examples: ['/ping 5'],
  argumentsFormat: /^(\d{1,2})$/,
  staffOnly: false,
  observerOnly: false,
  seatedOnly: true,
  gameStartedOnly: true,
  run: ({ game, user, args }) => {
    const player = game.publicPlayersState.find((seat) => seat.userName === user.userName);
    const seat = Number.parseInt(args[0], 10);

    const inRange = seat >= 1 && seat <= game.publicPlayersState.length;
    const cooledDown = !player?.pingTime || Date.now() - player.pingTime > 180000;
    if (!player || !inRange || !cooledDown) {
      return reply(game, user, 'در حال حاضر نمی‌توانید این بازیکن را فراخوانی کنید.');
    }

    const target = game.publicPlayersState[seat - 1];
    player.pingTime = Date.now();

    const socket = getHub().allSockets().find((s) => s.username === target.userName);
    if (!socket) return;
    socket.emit(
      'pingPlayer',
      game.general.blindMode || game.general.playerChats === 'disabled'
        ? 'هیتلر مخفی: یک بازیکن شما را فراخوانده است.'
        : `هیتلر مخفی: بازیکن ${user.userName} شما را فراخواند.`
    );

    if (game.general.playerChats === 'disabled') {
      game.private.seatedPlayers
        .find((seated) => seated.userName === player.userName)
        ?.gameChats.push(line(typed('player', game.general.blindMode ? `{${seat}}` : `${target.userName} (${seat})`), ' با موفقیت فراخوانده شد.'));
      game.private.hiddenInfoChat.push(line(`${player.userName} ${target.userName} را فراخواند.`));
    } else {
      game.chats.push({
        gameChat: true,
        timestamp: new Date(),
        chat: [
          {
            text: game.general.blindMode
              ? `یک بازیکن بازیکن شماره‌ی ${seat} را فراخواند.`
              : `${user.userName} ${target.userName} (${seat}) را فراخواند.`,
          },
        ],
        userName: user.userName,
        uid: game.general.uid,
      } as never);
    }
  },
});

export { findCommand };
