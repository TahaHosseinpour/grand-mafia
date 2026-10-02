'use client';

import { DoorOpen, Info, LayoutGrid, MessagesSquare, RotateCcw, Trophy, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { IconInput } from '@/components/ui/icon-input';
import { Modal } from '@/components/ui/modal';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { emit } from '../socket';
import { getState, setState, useClientState } from '../store';
import type { GameInfo } from '../wire';
import ActionSheet from './action-sheet';
import { ElectionTracker, FascistTrack, LiberalTrack, Piles, POWERS } from './board';
import ClaimButton from './claim-sheet';
import { myAction, mySeat } from './derive';
import GameChat from './game-chat';
import InfoSheets from './info-sheets';
import Seats from './seats';

/**
 * A table: the waiting room before the deal, then the board, the players and
 * the game's chat. On a phone the board and the chat are two tabs; from `lg`
 * up they sit side by side.
 */

const addAlert = (message: string) => setState((state) => ({ alerts: [...state.alerts, message] }));

function GameDetails({ game, open, onClose }: { game: GameInfo; open: boolean; onClose: () => void }) {
  const general = game.general;
  const settings = game.customGameSettings;
  const rows: [string, string][] = [
    ['نوع بازی', settings.enabled ? 'سفارشی' : general.practiceGame ? 'تمرینی' : general.casualGame ? 'غیررسمی' : 'رتبه‌ای'],
    ['بازیکنان', general.minPlayersCount === general.maxPlayersCount ? formatNumber(general.maxPlayersCount) : `${formatNumber(general.minPlayersCount)} تا ${formatNumber(general.maxPlayersCount)}`],
  ];
  if (general.timedMode) rows.push(['زمان هر تصمیم', `${formatNumber(Number(general.timedMode))} ثانیه`]);
  if (general.rainbowgame) rows.push(['ورود', 'فقط بازیکنان باتجربه']);
  if (general.isVerifiedOnly) rows.push(['ورود', 'فقط حساب‌های تأییدشده']);
  if (general.eloMinimum) rows.push(['حداقل ELO', formatNumber(general.eloMinimum)]);
  if (general.xpMinimum) rows.push(['حداقل XP', formatNumber(general.xpMinimum)]);
  if (general.experiencedMode) rows.push(['سرعت', 'سریع (انیمیشن کوتاه)']);
  if (general.blindMode) rows.push(['نام‌ها', 'ناشناس تا پایان بازی']);
  if (general.playerChats === 'disabled') rows.push(['چت بازیکنان', 'خاموش']);
  if (general.playerChats === 'emotes') rows.push(['چت بازیکنان', 'فقط ایموجی']);
  if (general.disableGamechat) rows.push(['پیام‌های بازی', 'خاموش']);
  if (general.avalonSH) rows.push(['آوالون', general.avalonSH.withPercival ? 'مرلین، پرسیوال و مورگانا' : 'مرلین']);
  if (general.monarchistSH) rows.push(['سلطنت‌طلب', 'دارد']);
  if (general.noTopdecking) rows.push(['تاپ‌دک', general.noTopdecking === 1 ? 'ممنوع' : 'یک بار']);
  if (settings.enabled && settings.powers) {
    rows.push(['قدرت‌ها', settings.powers.map((power, i) => `${formatNumber(i + 1)}: ${power ? POWERS[power]?.short : '—'}`).join('، ')]);
  }

  return (
    <Modal open={open} onClose={onClose} title={general.name} size="default">
      <dl className="divide-y divide-line">
        {rows.map(([label, value], i) => (
          <div key={i} className="flex justify-between gap-4 py-2.5">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-end font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

function TakeSeat({ game }: { game: GameInfo }) {
  const userInfo = useClientState((state) => state.userInfo);
  const me = useClientState((state) => state.userList.find((user) => user.userName === state.userInfo.userName));
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState('');
  const general = game.general;

  const sit = () => {
    const settings = userInfo.gameSettings ?? {};
    if (me?.staffIncognito) return addAlert('در حالت ناشناس نمی‌توانید بنشینید؛ اول آن را در تنظیمات خاموش کنید.');
    if (!general.private && settings.isPrivate) return addAlert('بازیکنانی که پروفایل خصوصی دارند فقط در بازی‌های خصوصی می‌نشینند.');
    if (general.rainbowgame && !me?.isRainbowOverall) return addAlert('این میز فقط برای بازیکنان باتجربه (دست‌کم ۱۰ امتیاز تجربه) است.');
    if (general.isVerifiedOnly && !userInfo.verified) return addAlert('این میز فقط برای حساب‌هایی است که ایمیلشان را تأیید کرده‌اند.');
    if (general.eloMinimum && !((me?.eloSeason ?? 0) >= general.eloMinimum || (me?.eloOverall ?? 0) >= general.eloMinimum)) {
      return addAlert(`برای این میز دست‌کم ${formatNumber(general.eloMinimum)} امتیاز ELO لازم است.`);
    }
    if (general.xpMinimum && (me?.xpOverall ?? 0) < general.xpMinimum) return addAlert(`برای این میز دست‌کم ${formatNumber(general.xpMinimum)} امتیاز تجربه لازم است.`);
    if (general.private && !general.whitelistedPlayers.includes(userInfo.userName ?? '')) return setAskPassword(true);
    emit('updateSeatedUser', { uid: general.uid });
  };

  return (
    <>
      <Button variant="primary" size="lg" fluid onClick={sit}>
        <UserPlus className="size-6" /> نشستن پشت میز
      </Button>
      <Modal open={askPassword} onClose={() => setAskPassword(false)} title="بازی خصوصی">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            emit('updateSeatedUser', { uid: general.uid, password });
            setAskPassword(false);
          }}
        >
          <p className="mb-3 text-fg-muted">برای نشستن، رمز این میز را وارد کنید.</p>
          <IconInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="رمز میز" autoFocus />
          <Button type="submit" variant="primary" size="lg" fluid className="mt-4" disabled={!password}>
            ورود
          </Button>
        </form>
      </Modal>
    </>
  );
}

function Pregame({ game }: { game: GameInfo }) {
  const userName = useClientState((state) => state.userInfo.userName);
  const seated = mySeat(game, userName) >= 0;
  const general = game.general;
  const open = general.maxPlayersCount - game.publicPlayersState.length;
  const canSit = Boolean(userName) && !seated && open > 0;

  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="mb-4 text-center">
        <p className="font-display text-[1.6rem] leading-tight">{general.status || 'منتظر بازیکن‌ها…'}</p>
        <p className="mt-1 text-[0.9rem] text-fg-muted">
          {formatNumber(game.publicPlayersState.length)} نفر نشسته‌اند، {formatNumber(Math.max(0, open))} صندلی خالی
        </p>
      </div>
      <Seats game={game} emptySeats={Math.max(0, open)} />
      <div className="mt-5">
        {canSit ? <TakeSeat game={game} /> : null}
        {!userName ? <p className="rounded-2xl bg-surface-2 px-4 py-3 text-center text-fg-muted">برای نشستن پشت میز، از بالای صفحه وارد حساب خود شوید.</p> : null}
      </div>
    </section>
  );
}

function GameOver({ game }: { game: GameInfo }) {
  const winner = game.gameState.isCompleted;
  if (!winner) return null;
  return (
    <div className={cn('flex items-center gap-3 rounded-3xl p-4', winner === 'liberal' ? 'bg-lib-deep' : 'bg-fas-deep')}>
      <Trophy className={cn('size-10 shrink-0', winner === 'liberal' ? 'text-lib-soft' : 'text-fas-soft')} />
      <div className="flex-1">
        <p className="font-display text-[1.8rem] leading-tight">{winner === 'liberal' ? 'لیبرال‌ها بردند!' : 'فاشیست‌ها بردند!'}</p>
        <p className="text-[0.9rem] text-fg-muted">نقش همه رو شد. بازی تا چند دقیقه‌ی دیگر بسته می‌شود.</p>
      </div>
      <a href="#/" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
        لابی
      </a>
    </div>
  );
}

function TableHeader({ game }: { game: GameInfo }) {
  const userName = useClientState((state) => state.userInfo.userName);
  const [details, setDetails] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [remakeVote, setRemakeVote] = useState(false);
  const seat = mySeat(game, userName);
  const running = game.gameState.isTracksFlipped && !game.gameState.isCompleted;
  const claim = seat >= 0 ? game.playersState?.[seat]?.claim : undefined;

  const leave = () => {
    window.location.hash = '#/';
  };

  return (
    <div className="sticky top-14 z-20 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[1.3rem] leading-tight" dir="auto">
            {game.general.name}
          </h1>
          <p className="truncate text-[0.85rem] text-accent-strong">{game.general.status}</p>
        </div>
        {claim ? <ClaimButton game={game} claim={claim} /> : null}
        {running && seat >= 0 && !game.general.isRemade ? (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={remakeVote}
            title="رأی به ساخت دوباره‌ی بازی"
            className={cn(remakeVote && 'bg-accent/20 text-accent-strong')}
            onClick={() => {
              emit('updateRemake', { uid: game.general.uid, remakeStatus: !remakeVote });
              setRemakeVote(!remakeVote);
            }}
          >
            <RotateCcw className="size-5" />
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" aria-label="مشخصات بازی" onClick={() => setDetails(true)}>
          <Info className="size-5" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="ترک میز" onClick={() => (running && seat >= 0 ? setConfirmLeave(true) : leave())}>
          <DoorOpen className="size-5" />
        </Button>
      </div>
      <GameDetails game={game} open={details} onClose={() => setDetails(false)} />
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="ترک بازی؟">
        <p className="text-fg-muted">بازی هنوز تمام نشده است. اگر بروید، هم‌تیمی‌هایتان تنها می‌مانند و ممکن است گزارش شوید.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            می‌مانم
          </Button>
          <Button variant="danger" onClick={leave}>
            ترک بازی
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Board({ game }: { game: GameInfo }) {
  const userName = useClientState((state) => state.userInfo.userName);
  const action = myAction(game, userName);
  const pickable = action && 'candidates' in action ? action.candidates : undefined;

  return (
    <div className="flex flex-col gap-3">
      <GameOver game={game} />
      <LiberalTrack game={game} />
      <FascistTrack game={game} />
      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2.5">
        <ElectionTracker game={game} />
        <Piles game={game} />
      </div>
      <Seats game={game} selectable={pickable} />
    </div>
  );
}

function useUnreadChat(game: GameInfo, watching: boolean) {
  const seen = useRef(game.chats.length);
  useEffect(() => {
    if (watching) {
      seen.current = game.chats.length;
      if (getState().unreadGameChat) setState({ unreadGameChat: 0 });
    } else if (game.chats.length > seen.current) {
      setState({ unreadGameChat: game.chats.length - seen.current });
    }
  }, [game.chats.length, watching]);
}

export default function TableScreen() {
  const game = useClientState((state) => state.gameInfo) as GameInfo;
  const userName = useClientState((state) => state.userInfo.userName);
  const tab = useClientState((state) => state.tableTab);
  const unread = useClientState((state) => state.unreadGameChat);
  const isDesktop = useIsDesktop();
  useUnreadChat(game, tab === 'chat' || isDesktop);

  const started = Boolean(game.gameState.isTracksFlipped);
  const seat = mySeat(game, userName);
  const action = myAction(game, userName);

  return (
    <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-4">
      <TableHeader game={game} />
      <div className="mx-auto max-w-[1400px] px-4 pt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
        <div className={cn(tab === 'board' ? 'block' : 'hidden', 'lg:block')}>{started ? <Board game={game} /> : <Pregame game={game} />}</div>
        <GameChat
          game={game}
          className={cn('h-[calc(100dvh-14rem-env(safe-area-inset-bottom))] lg:sticky lg:top-[7.5rem] lg:h-[calc(100dvh-9rem)]', tab === 'chat' ? 'flex' : 'hidden', 'lg:flex')}
        />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="میز و چت">
        <div className="mx-auto grid max-w-lg grid-cols-2">
          {(
            [
              { key: 'board', label: 'میز', icon: LayoutGrid },
              { key: 'chat', label: 'چت', icon: MessagesSquare },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setState({ tableTab: key })}
              aria-current={tab === key ? 'page' : undefined}
              className={cn('flex cursor-pointer flex-col items-center gap-0.5 py-2 text-[0.75rem] font-bold', tab === key ? 'text-accent-strong' : 'text-fg-faint')}
            >
              <span className="relative">
                <Icon className="size-6" />
                {key === 'chat' && unread > 0 ? (
                  <Badge tone="accent" className="absolute -end-4 -top-2 bg-accent px-1.5 py-0 text-[0.65rem] text-white">
                    {formatNumber(Math.min(unread, 99))}
                  </Badge>
                ) : null}
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {action && seat >= 0 ? <ActionSheet game={game} action={action} me={seat} /> : null}
      <InfoSheets game={game} userName={userName} />
    </div>
  );
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}
