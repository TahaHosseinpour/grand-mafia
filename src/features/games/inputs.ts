import { z, zCount } from '@/lib/validation';
import { isLegalGameName } from '@/lib/game-constants';

/**
 * Wire shapes for the game's Socket.IO events. Every handler parses its
 * payload with one of these before using it; a payload that does not parse
 * is dropped, never half-applied. Unknown keys pass through, as the legacy
 * client sends many optional flags the schema need not list.
 */

/** A seat number: a non-negative integer (the range is checked against the table). */
const seatIndex = z.number().int().nonnegative();

export const seatInput = (field: string) => z.object({ [field]: seatIndex } as Record<string, typeof seatIndex>).loose();
export const voteInput = z.object({ vote: z.boolean() }).loose();
export const policySelectionInput = z.object({ selection: z.number().int().min(0).max(3) }).loose();
export const chancellorInput = seatInput('chancellorIndex');
export const playerIndexInput = seatInput('playerIndex');

/** number, or a non-empty numeric string, coerced; anything else passes through to be rejected. */
const coerceNumeric = (value: unknown) =>
  typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

const intCoerce = z.preprocess(coerceNumeric, z.number().int());
const optionalNullableInt = z.preprocess(coerceNumeric, z.union([z.number().int(), z.null(), z.undefined()]));

export const VALID_POWERS = ['investigate', 'deckpeek', 'election', 'bullet', 'reverseinv', 'peekdrop'] as const;

const powerInput = z.preprocess(
  (value) => (value == null || value === '' || value === 'null' ? null : value),
  z.enum(VALID_POWERS).nullable()
);

export const customGameSettingsInput = z
  .object({
    enabled: z.literal(true),
    deckState: z.object({
      lib: intCoerce.refine((n) => n >= 5 && n <= 8),
      fas: intCoerce.refine((n) => n >= 5 && n <= 19),
    }),
    trackState: z.object({
      lib: intCoerce.refine((n) => n >= 0 && n <= 4),
      fas: intCoerce.refine((n) => n >= 0 && n <= 5),
    }),
    fascistCount: intCoerce.refine((n) => n >= 1),
    hitlerZone: intCoerce.refine((n) => n >= 1 && n <= 5),
    vetoZone: intCoerce.refine((n) => n >= 1 && n <= 5),
    powers: z.array(powerInput).length(5),
    hitKnowsFas: z.boolean().optional(),
    fasCanShootHit: z.boolean().optional(),
  })
  .loose()
  .refine((s) => s.vetoZone > s.trackState.fas, { message: 'vetoZone must exceed trackState.fas' })
  .refine((s) => s.deckState.lib + s.deckState.fas >= 13, { message: 'deck needs at least 13 cards' });

export const createGameInput = z
  .object({
    minPlayersCount: optionalNullableInt,
    maxPlayersCount: optionalNullableInt,
    excludedPlayerCount: z.array(z.number()).optional(),
    gameName: z
      .string()
      .min(1)
      .max(20)
      .refine(isLegalGameName, { message: 'illegal characters in game name' }),
    xpSliderValue: z.union([z.string(), z.number()]).nullable().optional(),
    eloSliderValue: z.union([z.string(), z.number()]).nullable().optional(),
    noTopdecking: z.number().int().min(0).max(2).optional(),
    privatePassword: z.union([z.string().max(50), z.literal(false)]).optional(),
    customGameSettings: z.object({}).loose().optional(),
    flag: z.string().max(32).optional(),
    gameType: z.enum(['ranked', 'casual', 'practice', 'custom']).optional(),
    experiencedMode: z.boolean().optional(),
    playerChats: z.string().max(16).optional(),
    disableObserverLobby: z.boolean().optional(),
    disableObserver: z.boolean().optional(),
    isVerifiedOnly: z.boolean().optional(),
    disableGamechat: z.boolean().optional(),
    rainbowgame: z.boolean().optional(),
    blindMode: z.boolean().optional(),
    flappyMode: z.boolean().optional(),
    flappyOnlyMode: z.boolean().optional(),
    timedMode: z.union([z.number(), z.literal(false)]).optional(),
    rebalance6p: z.boolean().optional(),
    rebalance7p: z.boolean().optional(),
    rebalance9p2f: z.boolean().optional(),
    unlistedGame: z.boolean().optional(),
    privateAnonymousRemakes: z.boolean().optional(),
    avalonSH: z.boolean().optional(),
    withPercival: z.boolean().optional(),
    monarchistSH: z.boolean().optional(),
    casualGame: z.boolean().optional(),
  })
  .loose();
export type CreateGameInput = z.output<typeof createGameInput>;

export const joinGameInput = z.object({ uid: z.string(), password: z.string().optional() }).loose();
export const whitelistInput = z.object({ uid: z.string(), password: z.string().optional(), whitelistPlayers: z.array(z.string()) }).loose();
export const leaveGameInput = z.object({ uid: z.string().optional(), isRemake: z.boolean().optional() }).loose();
export const remakeInput = z.object({ uid: z.string(), remakeStatus: z.boolean().optional() }).loose();
export const claimInput = z.object({ claim: z.string().optional(), claimState: z.string().optional() }).loose();
export const generalChatInput = z.object({ chat: z.string() }).loose();
export const gameChatInput = z.object({ chat: z.string(), uid: z.string().optional() }).loose();

/** The game a payload names, for events scoped to one game. */
export const uidInput = z.object({ uid: z.string() }).loose();

export { zCount };
