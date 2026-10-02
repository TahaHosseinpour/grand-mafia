import { claimInput } from '../inputs';
import { sendInProgressGameUpdate } from './updates';
import type { HubSocket } from './hub';
import type { Caller, ChatPart, Game, PolicyName } from './types';

const LETTERS: Record<string, PolicyName> = { r: 'fascist', b: 'liberal' };
const fromLetters = (state: string): PolicyName[] => [...state].map((letter) => LETTERS[letter]);

const CLAIM_PATTERN = /^(wasPresident|wasChancellor|didSinglePolicyPeek|didPolicyPeek|didInvestigateLoyalty)$/;

/**
 * After a government, the president/chancellor (or the peeker or investigator)
 * may claim what they saw with one click. The claim is announced to the table
 * and recorded in the game summary (legacy `handleAddNewClaim`).
 * @returns whether a claim was made
 */
export function handleAddNewClaim(socket: HubSocket, caller: Caller, game: Game, raw: unknown): boolean {
  const parsed = claimInput.safeParse(raw);
  if (!parsed.success) return false;
  const data = parsed.data;

  const playerIndex = game.publicPlayersState.findIndex((player) => player.userName === caller.username);
  const seat = game.private.seatedPlayers[playerIndex];
  if (!seat?.playersState?.[playerIndex]) return false;
  if (!CLAIM_PATTERN.test(seat.playersState[playerIndex].claim ?? '')) return false;
  if (!game.private.summary || game.publicPlayersState[playerIndex].isDead) return false;

  const { blindMode, replacementNames } = game.general;
  const name = blindMode ? `${replacementNames?.[playerIndex]} {${playerIndex + 1}} ` : `${caller.username} {${playerIndex + 1}} `;
  const summary = game.private.summary;
  const state = data.claimState ?? '';

  const chat = ((): ChatPart[] | undefined => {
    switch (data.claim) {
      case 'wasPresident':
        if (!['rrr', 'rrb', 'rbb', 'bbb'].includes(state)) return undefined;
        summary.updateLog({ presidentClaim: fromLetters(state) }, { presidentId: playerIndex });
        return [{ text: 'رئیس‌جمهور ' }, { text: name, type: 'player' }, { text: 'ادعا می‌کند ' }, { claim: state }, { text: '.' }];

      case 'wasChancellor':
        if (!['rr', 'rb', 'bb'].includes(state)) return undefined;
        summary.updateLog({ chancellorClaim: fromLetters(state) }, { chancellorId: playerIndex });
        return [{ text: 'صدراعظم ' }, { text: name, type: 'player' }, { text: 'ادعا می‌کند ' }, { claim: state }, { text: '.' }];

      case 'didSinglePolicyPeek':
        if (state !== 'liberal' && state !== 'fascist') return undefined;
        return [
          { text: 'رئیس‌جمهور ' },
          { text: name, type: 'player' },
          { text: 'ادعا می‌کند به یک ' },
          { text: state === 'liberal' ? 'قانون لیبرال' : 'قانون فاشیستی', type: state },
          { text: ' نگاه کرده است.' },
        ];

      case 'didPolicyPeek':
        if (!/^[rb]{3}$/.test(state)) return undefined;
        summary.updateLog({ policyPeekClaim: fromLetters(state) }, { presidentId: playerIndex });
        return [{ text: 'رئیس‌جمهور ' }, { text: name, type: 'player' }, { text: 'ادعا می‌کند به این قوانین نگاه کرده است: ' }, { claim: state }, { text: '.' }];

      case 'didInvestigateLoyalty': {
        const { invIndex } = game.private;
        const head: ChatPart[] =
          invIndex !== -1 && invIndex < game.private.seatedPlayers.length
            ? [
                { text: 'رئیس‌جمهور ' },
                { text: name, type: 'player' },
                { text: 'عضویت حزبی ' },
                { text: blindMode ? `${replacementNames?.[invIndex]} {${invIndex + 1}} ` : `${game.private.seatedPlayers[invIndex]?.userName} {${invIndex + 1}} `, type: 'player' },
                { text: 'را دیده و ادعا می‌کند عضو ' },
              ]
            : [{ text: 'رئیس‌جمهور ' }, { text: name, type: 'player' }, { text: 'ادعا می‌کند عضو ' }];

        summary.updateLog({ investigationClaim: state }, { investigatorId: playerIndex });

        if (state === 'fascist') return [...head, { text: 'تیم فاشیست ', type: 'fascist' }, { text: 'را دیده است.' }];
        if (state === 'liberal') return [...head, { text: 'تیم لیبرال ', type: 'liberal' }, { text: 'را دیده است.' }];
        return undefined;
      }

      default:
        return undefined;
    }
  })();

  if (!chat) return false;

  seat.playersState[playerIndex].claim = '';
  game.chats.push({
    chat,
    isClaim: true,
    timestamp: new Date(),
    uid: game.general.uid,
    userName: caller.username,
    claim: data.claim,
    claimState: data.claimState,
  });
  socket.emit('removeClaim');
  sendInProgressGameUpdate(game);
  return true;
}
