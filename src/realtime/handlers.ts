import 'server-only';
import {
  acknowledgeWarning,
  checkRestriction,
  chancellorInput,
  confirmTerms,
  findGame,
  getEmoteList,
  handleAddNewClaim,
  handleAddNewGame,
  handleAddNewGameChat,
  handleFeedbackForm,
  handleHasSeenNewPlayerModal,
  handleNewGeneralChat,
  handleSeatRequest,
  handleSocketDisconnect,
  handleUpdateWhitelist,
  handleUpdatedBio,
  handleUpdatedGameSettings,
  handleUpdatedRemakeGame,
  handleUpdatedTheme,
  handleUserLeaveGame,
  leaveGameInput,
  playerIndexInput,
  policySelectionInput,
  selectBurnCard,
  selectChancellor,
  selectChancellorPolicy,
  selectChancellorVoteOnVeto,
  selectOnePolicy,
  selectPartyMembershipInvestigate,
  selectPartyMembershipInvestigateReverse,
  selectPlayerToAssassinate,
  selectPlayerToExecute,
  selectPolicies,
  selectPresidentPolicy,
  selectPresidentVoteOnVeto,
  selectSpecialElection,
  selectVoting,
  sendGameInfo,
  sendGameList,
  sendGeneralChats,
  sendPlayerNotes,
  sendUserGameSettings,
  sendUserList,
  updateStatusFor,
  voteInput,
  type Caller,
  type Game,
  type HubSocket,
} from '@/features/games/realtime';
import { EVENTS, logSecurityEvent } from '@/server/events';
import { rootLogger } from '@/server/logger';
import { isFullStaff } from '@/server/staff';
import type { z } from '@/lib/validation';
import type { GameSocket } from './hub';

/**
 * Registers the game's event handlers on one connection.
 *
 * Every handler here is thin: it checks who may send the event (signed in,
 * not restricted, seated at the table the payload names), parses the payload
 * with the engine's Zod input, and hands over to the engine. The caller's
 * identity is `socket.data.actor`, resolved at handshake — a `username` in a
 * payload is never believed.
 *
 * Not wired yet (later phases): moderation events (`updateModAction`,
 * `getModInfo`, `subscribeModChat`, `modPeekVotes`, `modGetRemakes`,
 * `modFreezeGame`, `getUserReports`, `playerReport`, `seeWarnings`,
 * `getSignups`…, mod DMs) in phase 5.
 */

const log = rootLogger.child({ module: 'realtime' });

/** Names a client must never be able to emit into our listeners. */
const RESERVED_INBOUND_EVENTS = new Set([
  'error',
  'connect',
  'connecting',
  'disconnect',
  'disconnecting',
  'connect_error',
  'connect_timeout',
  'newListener',
  'removeListener',
]);

/** A client that sends more events than this in one window is ignored until the window ends. */
const FLOOD_WINDOW_MS = 5_000;
const FLOOD_MAX_EVENTS = 100;

export type Session = {
  /** Terms or a warning are waiting for the player: game events are refused. */
  restricted: boolean;
};

type Context = {
  socket: GameSocket;
  hub: HubSocket;
  /** The signed-in player, or null for an observer. */
  caller: Caller | null;
  session: Session;
};

type Access = 'open' | 'user' | 'player';

const uidOf = (data: unknown): unknown => (data && typeof data === 'object' ? (data as { uid?: unknown }).uid : undefined);

function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

export function registerHandlers(socket: GameSocket, hub: HubSocket, session: Session, ready: Promise<boolean>): void {
  const actor = socket.data.actor;
  const caller: Caller | null = actor ? { username: actor.username } : null;
  const context: Context = { socket, hub, caller, session };
  const isAem = isFullStaff(actor?.staffRole);

  /* ---- Packet middleware ---------------------------------------------- */

  let windowStart = Date.now();
  let windowCount = 0;
  let floodLogged = false;

  socket.use((packet, next) => {
    const [event, data] = packet;
    if (typeof event !== 'string' || RESERVED_INBOUND_EVENTS.has(event)) return;

    const now = Date.now();
    if (now - windowStart > FLOOD_WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
      floodLogged = false;
    }
    windowCount += 1;
    if (windowCount > FLOOD_MAX_EVENTS) {
      if (!floodLogged) {
        floodLogged = true;
        logSecurityEvent(EVENTS.SECURITY_RATE_LIMIT, { scope: 'socket', user: caller?.username ?? null, socketId: socket.id });
      }
      return;
    }

    // A payload naming a game that is gone: tell the client its table is empty instead of failing.
    const uid = uidOf(data);
    if (uid && !findGame(uid)) {
      socket.emit('gameUpdate', {});
      return;
    }
    next();
  });

  /* ---- Registration helper -------------------------------------------- */

  /** Runs `run` for `event` once the connection is admitted, if the sender has the access it needs. */
  const on = (event: string, access: Access, run: (data: unknown, ctx: Context, rest: unknown[]) => unknown): void => {
    socket.on(event, (...args: unknown[]) => {
      void (async () => {
        try {
          if (!(await ready)) return;
          if (access !== 'open' && !caller) return;
          if (access === 'player' && session.restricted) return;
          await run(args[0], context, args.slice(1));
        } catch (error) {
          log.error({ err: error, event, user: caller?.username ?? null }, 'socket handler failed');
        }
      })();
    });
  };

  /** The live game the payload names, if the caller is seated at it. */
  const seatedGame = (data: unknown): Game | undefined => {
    const game = findGame(uidOf(data));
    if (!game || !caller || !game.gameState) return undefined;
    return game.publicPlayersState.some((seat) => seat.userName === caller.username) ? game : undefined;
  };

  /** Registers an in-game action: caller seated, not restricted, payload parsed. */
  const gameAction = <S extends z.ZodType>(event: string, schema: S, run: (game: Game, data: z.output<S>, caller: Caller) => void): void => {
    on(event, 'player', (data) => {
      const game = seatedGame(data);
      const parsed = parse(schema, data);
      if (game && parsed && caller) run(game, parsed, caller);
    });
  };

  /* ---- Connection ----------------------------------------------------- */

  socket.on('disconnect', () => {
    const username = caller?.username ?? null;
    if (!username) return;
    // A newer connection of the same player (a second tab, a reconnect) keeps them online.
    const stillHere = [...socket.nsp.sockets.values()].some((other) => other.id !== socket.id && other.data.actor?.username === username);
    if (!stillHere) handleSocketDisconnect(username);
  });

  /* ---- Lists and info (open to observers) ----------------------------- */

  const sendUsers = () => sendUserList(hub);
  on('requestUserList', 'open', sendUsers);
  on('getUserList', 'open', sendUsers);
  on('getGameList', 'open', () => sendGameList(hub, isAem));
  on('getGameInfo', 'open', (uid) => sendGameInfo(hub, uid));
  on('getGeneralChats', 'open', () => sendGeneralChats(hub));
  on('getEmoteList', 'open', () => hub.emit('emoteList', getEmoteList()));
  on('getUserGameSettings', 'user', () => sendUserGameSettings(hub));
  on('getPlayerNotes', 'user', (data) => sendPlayerNotes(hub, data));
  // `updateUserStatus(type, gameId)`: the client says which table it is looking at.
  on('updateUserStatus', 'user', (_type, ctx, [gameId]) => updateStatusFor(ctx.hub, typeof gameId === 'string' ? gameId : undefined));

  /* ---- Account: restrictions, settings, feedback ---------------------- */

  const recheck = async () => {
    session.restricted = await checkRestriction(hub);
  };
  on('receiveRestrictions', 'user', recheck);
  on('hasSeenNewPlayerModal', 'user', (_data, ctx) => handleHasSeenNewPlayerModal(ctx.hub, ctx.caller as Caller));
  on('confirmTOU', 'user', async () => {
    if (session.restricted) session.restricted = await confirmTerms(hub);
  });
  on('acknowledgeWarning', 'user', async () => {
    if (session.restricted) session.restricted = await acknowledgeWarning(hub);
  });
  on('feedbackForm', 'open', (data) => handleFeedbackForm(hub, data));
  on('updateGameSettings', 'user', (data, ctx) => handleUpdatedGameSettings(ctx.hub, ctx.caller as Caller, data));
  on('updateBio', 'user', (data, ctx) => handleUpdatedBio(ctx.hub, ctx.caller as Caller, data));
  on('handleUpdatedTheme', 'user', (data, ctx) => handleUpdatedTheme(ctx.hub, ctx.caller as Caller, data));

  /* ---- Lobby and chat -------------------------------------------------- */

  on('addNewGame', 'player', (data, ctx) => handleAddNewGame(ctx.hub, ctx.caller as Caller, data));
  on('updateSeatedUser', 'player', (data, ctx) => handleSeatRequest(ctx.hub, ctx.caller as Caller, data));
  on('addNewGeneralChat', 'player', (data, ctx) => handleNewGeneralChat(ctx.hub, ctx.caller as Caller, data));
  on('addNewGameChat', 'player', (data, ctx) => handleAddNewGameChat(ctx.hub, ctx.caller as Caller, data, findGame(uidOf(data))));

  on('updateGameWhitelist', 'user', (data, ctx) => {
    if (seatedGame(data)) handleUpdateWhitelist(ctx.caller as Caller, data);
  });
  on('addNewClaim', 'user', (data, ctx) => {
    const game = seatedGame(data);
    if (game) handleAddNewClaim(ctx.hub, ctx.caller as Caller, game, data);
  });
  on('updateRemake', 'user', (data, ctx) => {
    const game = seatedGame(data);
    if (game) handleUpdatedRemakeGame(ctx.caller as Caller, game, data, ctx.hub);
  });
  on('leaveGame', 'user', (data, ctx) => {
    const game = findGame(uidOf(data));
    if (!game) return;
    ctx.hub.leave(game.general.uid);
    handleUserLeaveGame(ctx.hub, game, ctx.caller as Caller, parse(leaveGameInput, data) ?? {});
  });

  /* ---- Elections ------------------------------------------------------- */

  gameAction('presidentSelectedChancellor', chancellorInput, (game, data, who) => selectChancellor(hub, who, game, data));
  gameAction('selectedVoting', voteInput, (game, data, who) => selectVoting(who, game, data, hub));
  gameAction('selectedPresidentPolicy', policySelectionInput, (game, data, who) => selectPresidentPolicy(who, game, data, false, hub));
  gameAction('selectedChancellorPolicy', policySelectionInput, (game, data, who) => selectChancellorPolicy(who, game, data, false, hub));
  gameAction('selectedPresidentVoteOnVeto', voteInput, (game, data, who) => selectPresidentVoteOnVeto(who, game, data, hub));
  gameAction('selectedChancellorVoteOnVeto', voteInput, (game, data, who) => selectChancellorVoteOnVeto(who, game, data, hub));

  /* ---- Presidential powers --------------------------------------------- */

  gameAction('selectPartyMembershipInvestigate', playerIndexInput, (game, data, who) => selectPartyMembershipInvestigate(who, game, data, hub));
  gameAction('selectPartyMembershipInvestigateReverse', playerIndexInput, (game, data, who) =>
    selectPartyMembershipInvestigateReverse(who, game, data, hub)
  );
  on('selectedPolicies', 'player', (data) => {
    const game = seatedGame(data);
    if (!game || !caller) return;
    if (game.private.lock.policyPeekAndDrop) selectOnePolicy(caller, game, hub);
    else selectPolicies(caller, game);
  });
  gameAction('selectedPresidentVoteOnBurn', voteInput, (game, data, who) => selectBurnCard(who, game, data, hub));
  gameAction('selectedPlayerToExecute', playerIndexInput, (game, data, who) => selectPlayerToExecute(who, game, data, hub));
  gameAction('selectedSpecialElection', playerIndexInput, (game, data, who) => selectSpecialElection(who, game, data, hub));
  gameAction('selectedPlayerToAssassinate', playerIndexInput, (game, data, who) => selectPlayerToAssassinate(who, game, data, hub));
}
