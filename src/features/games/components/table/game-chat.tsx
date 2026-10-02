'use client';

import { formatTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import ChatInput from '../common/chat-input';
import { EmoteText, GameLineParts, isGameLine } from '../common/chat-text';
import { playerColor } from '../common/player-color';
import { useStickToBottom } from '../common/use-stick-to-bottom';
import { emit } from '../socket';
import { useClientState } from '../store';
import type { GameInfo } from '../wire';
import { mySeat } from './derive';

/** A table's chat: what the game announces, claims, and what people type. */
export default function GameChat({ game, className }: { game: GameInfo; className?: string }) {
  const userName = useClientState((state) => state.userInfo.userName);
  const settings = useClientState((state) => state.userInfo.gameSettings);
  const userList = useClientState((state) => state.userList);
  const list = useStickToBottom<HTMLDivElement>(game.chats.length);
  const seat = mySeat(game, userName);
  const player = seat >= 0 ? game.publicPlayersState[seat] : null;
  const running = game.gameState.isStarted && !game.gameState.isCompleted;
  const blind = game.general.blindMode && !game.gameState.isCompleted;

  // Sorted by time: the server mixes the table's lines and this player's own lines.
  const chats = [...game.chats].sort((a, b) => new Date(a.timestamp as string).getTime() - new Date(b.timestamp as string).getTime());

  const silenced =
    !userName
      ? 'برای گفتگو وارد حساب خود شوید.'
      : player?.isDead && running
        ? 'مرده‌ها حرف نمی‌زنند.'
        : player?.leftGame
          ? 'شما این بازی را ترک کرده‌اید.'
          : running && player && game.general.playerChats === 'disabled'
            ? 'چت بازیکنان در این بازی خاموش است.'
            : !player && game.general.disableObserverLobby
              ? 'تماشاگران در این بازی پیام نمی‌دهند.'
              : null;

  return (
    <section className={cn('flex min-h-0 flex-col', className)} aria-label="چت بازی">
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-surface px-3 py-2">
        <ul className="flex flex-col gap-1">
          {chats.map((entry, i) => {
            const time = settings?.enableTimestamps ? <span className="me-1.5 text-[0.7rem] text-fg-faint">{formatTime(entry.timestamp as string)}</span> : null;
            if (isGameLine(entry)) {
              const isClaim = (entry as { isClaim?: boolean }).isClaim;
              return (
                <li key={i} className={cn('rounded-lg px-2 py-1 leading-relaxed text-fg-muted', isClaim ? 'bg-gold/10 text-fg' : 'bg-surface-2/60')}>
                  {time}
                  <GameLineParts parts={entry.chat as never} />
                </li>
              );
            }
            const message = entry as { chat: string; userName: string; staffRole?: string };
            const user = blind ? undefined : userList.find((u) => u.userName === message.userName);
            const color = settings?.disablePlayerColorsInChat ? undefined : playerColor(user, !settings?.disableSeasonal, settings?.disableElo);
            const seatIndex = game.publicPlayersState.findIndex((p) => p.userName === message.userName);
            const shownName = blind && seatIndex >= 0 && game.general.replacementNames ? game.general.replacementNames[seatIndex] : message.userName;
            return (
              <li key={i} className="px-1 py-0.5 leading-relaxed break-words">
                {time}
                <span className="font-bold" style={color ? { color } : undefined} dir="auto">
                  {seatIndex >= 0 && game.gameState.isTracksFlipped ? `${(seatIndex + 1).toLocaleString('fa-IR')}. ` : ''}
                  {shownName}
                </span>
                {seatIndex < 0 ? <span className="ms-1 text-[0.7rem] text-fg-faint">(تماشاگر)</span> : null}
                <span className="text-fg-faint">: </span>
                <span dir="auto">
                  <EmoteText text={message.chat} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <ChatInput
        className="mt-2"
        placeholder={player ? 'به هم‌بازی‌ها بگویید…' : 'پیام تماشاگر…'}
        disabled={Boolean(silenced)}
        disabledText={silenced ?? undefined}
        onSend={(chat) => emit('addNewGameChat', { uid: game.general.uid, chat })}
      />
    </section>
  );
}
