'use client';

import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { emit } from '../socket';
import { useClientState } from '../store';
import type { GameInfo } from '../wire';
import { BallotCard, PolicyCard } from './cards';
import type { MyAction } from './derive';
import { seatName } from './seats';

/**
 * Whatever the game is waiting on this player for, as one sheet: choose,
 * then confirm. The sheet can be put away («بعداً») and brought back from the
 * «نوبت شماست» button; it reopens by itself for each new decision.
 */

type Props = { game: GameInfo; action: MyAction; me: number };

const keyOf = (game: GameInfo, action: MyAction) => `${game.general.uid}:${game.general.electionCount}:${game.gameState.phase}:${action.kind}`;

function SeatPicker({ game, candidates, value, onChange, me }: { game: GameInfo; candidates: number[]; value: number | null; onChange: (seat: number) => void; me: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
      {game.publicPlayersState.map((player, index) => {
        if (!candidates.includes(index)) return null;
        const name = seatName(game, index, me >= 0, false);
        return (
          <button
            key={index}
            type="button"
            onClick={() => onChange(index)}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl bg-surface-2 px-2 py-3 ring-1 ring-line transition hover:bg-surface-3',
              value === index && 'bg-gold/15 ring-4 ring-gold'
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-surface-3 font-display text-[1.4rem] text-fg">{name.slice(0, 1).toUpperCase()}</span>
            <span className="w-full truncate text-[0.8rem] font-bold" dir="auto">
              {name}
            </span>
            <span className="text-[0.7rem] text-fg-faint">صندلی {(index + 1).toLocaleString('fa-IR')}</span>
          </button>
        );
      })}
    </div>
  );
}

function Ballots({ value, onChange }: { value: boolean | null; onChange: (vote: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <BallotCard vote="ja" className="w-full" selected={value === true} dimmed={value === false} onClick={() => onChange(true)} />
      <BallotCard vote="nein" className="w-full" selected={value === false} dimmed={value === true} onClick={() => onChange(false)} />
    </div>
  );
}

function governmentNames(game: GameInfo, me: number) {
  const president = game.publicPlayersState.findIndex((p) => p.governmentStatus === 'isPresident' || p.governmentStatus === 'isPendingPresident');
  const chancellor = game.publicPlayersState.findIndex((p) => p.governmentStatus === 'isChancellor' || p.governmentStatus === 'isPendingChancellor');
  return {
    president: president >= 0 ? seatName(game, president, me >= 0, false) : 'رئیس‌جمهور',
    chancellor: chancellor >= 0 ? seatName(game, chancellor, me >= 0, false) : 'صدراعظم',
  };
}

function Content({ game, action, me, onDone }: Props & { onDone: () => void }) {
  const uid = game.general.uid;
  const [seat, setSeat] = useState<number | null>(null);
  const [card, setCard] = useState<number | null>(null);
  const [vote, setVote] = useState<boolean | null>(action.kind === 'vote' ? action.chosen : null);
  const names = governmentNames(game, me);
  const send = (event: string, payload: Record<string, unknown>) => {
    emit(event, { uid, ...payload });
    onDone();
  };

  switch (action.kind) {
    case 'nominate':
      return (
        <Section title="انتخاب صدراعظم" text="شما رئیس‌جمهور هستید. یکی از این بازیکنان را برای صدارت نامزد کنید؛ بعد همه رأی می‌دهند.">
          <SeatPicker game={game} candidates={action.candidates} value={seat} onChange={setSeat} me={me} />
          <Confirm disabled={seat === null} onClick={() => send('presidentSelectedChancellor', { chancellorIndex: seat })}>
            نامزد کن
          </Confirm>
        </Section>
      );

    case 'vote':
      return (
        <Section
          title="رأی‌گیری"
          text={
            <>
              <b className="text-fg">{names.president}</b> نامزد کرده است که <b className="text-fg">{names.chancellor}</b> صدراعظم شود. با این دولت موافقید؟ اگر بیش از نیمی از آرا «آری» باشد، دولت تشکیل
              می‌شود.
            </>
          }
        >
          <Ballots value={vote} onChange={setVote} />
          <Confirm disabled={vote === null || vote === action.chosen} onClick={() => send('selectedVoting', { vote })}>
            {action.chosen === null ? 'ثبت رأی' : 'تغییر رأی'}
          </Confirm>
        </Section>
      );

    case 'discard':
      return (
        <Section title="دورریختن یک قانون" text="سه قانون از دسته کشیدید. یکی را دور بیندازید؛ دو قانون دیگر به صدراعظم می‌رسد.">
          <div className="grid grid-cols-3 gap-3">
            {action.cards.map((policy, i) => (
              <PolicyCard key={i} policy={policy} className="w-full" selected={card === i} onClick={() => setCard(i)} />
            ))}
          </div>
          <Confirm variant="fas" disabled={card === null} onClick={() => send('selectedPresidentPolicy', { selection: card })}>
            دور بینداز
          </Confirm>
        </Section>
      );

    case 'enact':
      return (
        <Section
          title="تصویب یک قانون"
          text={
            action.vetoUnlocked
              ? 'یکی از این دو قانون را برای تصویب انتخاب کنید. وتو آزاد است: پس از انتخاب می‌توانید درخواست وتو بدهید.'
              : 'یکی از این دو قانون را برای تصویب انتخاب کنید؛ دیگری دور ریخته می‌شود.'
          }
        >
          <div className="mx-auto grid max-w-xs grid-cols-2 gap-4">
            {action.cards.map((policy, i) => (
              <PolicyCard key={i} policy={policy} className="w-full" selected={card === i} onClick={() => setCard(i)} />
            ))}
          </div>
          {/* The server reads selection 3 as «the second card». */}
          <Confirm disabled={card === null} onClick={() => send('selectedChancellorPolicy', { selection: card === 1 ? 3 : 0 })}>
            تصویب کن
          </Confirm>
        </Section>
      );

    case 'chancellorVeto':
      return (
        <Section title="وتو؟" text="آیا می‌خواهید قانونی را که انتخاب کرده‌اید وتو کنید؟ اگر رئیس‌جمهور هم موافق باشد، هیچ قانونی تصویب نمی‌شود.">
          <Ballots value={vote} onChange={setVote} />
          <Confirm disabled={vote === null} onClick={() => send('selectedChancellorVoteOnVeto', { vote })}>
            ثبت
          </Confirm>
        </Section>
      );

    case 'presidentVeto':
      return (
        <Section title="درخواست وتو" text={`${names.chancellor} درخواست وتو داده است. موافقید هیچ‌کدام از این قوانین تصویب نشود؟`}>
          <Ballots value={vote} onChange={setVote} />
          <Confirm disabled={vote === null} onClick={() => send('selectedPresidentVoteOnVeto', { vote })}>
            ثبت
          </Confirm>
        </Section>
      );

    case 'burn':
      return (
        <Section title="دورریختن قانون بالای دسته؟" text="«آری» یعنی قانونی که دیدید دور ریخته شود؛ «نه» یعنی روی دسته بماند.">
          <Ballots value={vote} onChange={setVote} />
          <Confirm disabled={vote === null} onClick={() => send('selectedPresidentVoteOnBurn', { vote })}>
            ثبت
          </Confirm>
        </Section>
      );

    case 'peek':
    case 'peekDrop':
      return (
        <Section
          title={action.kind === 'peek' ? 'نگاه به دسته' : 'نگاه به قانون بالای دسته'}
          text={action.kind === 'peek' ? 'قدرت ریاست‌جمهوری: سه قانون بالای دسته را ببینید.' : 'قدرت ریاست‌جمهوری: قانون بالای دسته را ببینید و تصمیم بگیرید دور ریخته شود یا نه.'}
        >
          <div className="flex justify-center gap-3">
            {Array.from({ length: action.kind === 'peek' ? 3 : 1 }, (_, i) => (
              <PolicyCard key={i} className="w-20" />
            ))}
          </div>
          <Confirm onClick={() => send('selectedPolicies', {})}>نشانم بده</Confirm>
        </Section>
      );

    case 'investigate':
    case 'reveal':
    case 'specialElection':
    case 'execute':
    case 'assassinate': {
      const copy = {
        investigate: { title: 'تحقیق عضویت', text: 'عضویت حزبی کدام بازیکن را می‌خواهید ببینید؟', button: 'تحقیق کن', event: 'selectPartyMembershipInvestigate', variant: 'primary' },
        reveal: { title: 'نمایش عضویت', text: 'عضویت حزبی خودتان را به کدام بازیکن نشان می‌دهید؟', button: 'نشان بده', event: 'selectPartyMembershipInvestigateReverse', variant: 'primary' },
        specialElection: { title: 'انتخابات ویژه', text: 'چه کسی نامزد ریاست‌جمهوری بعدی باشد؟', button: 'انتخاب کن', event: 'selectedSpecialElection', variant: 'primary' },
        execute: { title: 'اعدام', text: 'یک بازیکن را برای اعدام انتخاب کنید. اگر هیتلر باشد، لیبرال‌ها می‌برند.', button: 'اعدام کن', event: 'selectedPlayerToExecute', variant: 'danger' },
        assassinate: { title: 'ترور', text: 'به نظر شما مرلین کیست؟ اگر درست حدس بزنید، فاشیست‌ها می‌برند.', button: 'ترور کن', event: 'selectedPlayerToAssassinate', variant: 'danger' },
      }[action.kind];
      return (
        <Section title={copy.title} text={copy.text}>
          <SeatPicker game={game} candidates={action.candidates} value={seat} onChange={setSeat} me={me} />
          <Confirm variant={copy.variant as 'primary' | 'danger'} disabled={seat === null} onClick={() => send(copy.event, { playerIndex: seat })}>
            {copy.button}
          </Confirm>
        </Section>
      );
    }
  }
}

function Section({ title, text, children }: { title: string; text: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="pe-10 font-display text-[1.9rem] leading-tight">{title}</h2>
      <p className="mb-5 mt-1 leading-relaxed text-fg-muted">{text}</p>
      {children}
    </div>
  );
}

function Confirm({ children, variant = 'primary', ...props }: { children: React.ReactNode; variant?: 'primary' | 'danger' | 'fas'; disabled?: boolean; onClick: () => void }) {
  return (
    <Button variant={variant} size="lg" fluid className="mt-6" {...props}>
      {children}
    </Button>
  );
}

export default function ActionSheet({ game, action, me }: Props) {
  const key = keyOf(game, action);
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const [reopenedKey, setReopenedKey] = useState<string | null>(null);
  const muted = useClientState((state) => state.userInfo.gameSettings?.soundStatus === 'Off');
  // A cast vote stays changeable until the last ballot is in, but is no longer a «your turn».
  const settled = action.kind === 'vote' && action.chosen !== null;
  const open = (!settled || reopenedKey === key) && hiddenKey !== key && doneKey !== key;

  // A little buzz on phones when the game starts waiting on us.
  useEffect(() => {
    if (!settled && !muted && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(120);
  }, [key, muted, settled]);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setHiddenKey(null);
            setDoneKey(null);
            if (settled) setReopenedKey(key);
          }}
          className={cn(
            'fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex cursor-pointer items-center justify-center gap-2 rounded-2xl py-3 font-display text-[1.3rem] lg:inset-x-auto lg:end-8 lg:w-80',
            settled ? 'bg-surface-3 text-fg-muted shadow-[0_4px_0_#151311]' : 'animate-bounce bg-gold text-paper-ink shadow-[0_4px_0_#9c7424]'
          )}
        >
          {settled ? (
            'رأی شما ثبت شد — تغییر رأی'
          ) : (
            <>
              <BellRing className="size-5" /> نوبت شماست
            </>
          )}
        </button>
      ) : null}
      <Modal open={open} onClose={() => setHiddenKey(key)} size="default">
        <Content
          key={key}
          game={game}
          action={action}
          me={me}
          onDone={() => {
            setDoneKey(key);
            setReopenedKey(null);
          }}
        />
        <button type="button" onClick={() => setHiddenKey(key)} className="mt-3 w-full cursor-pointer py-2 text-center text-fg-faint hover:text-fg-muted">
          بعداً — اول میز را ببینم
        </button>
      </Modal>
    </>
  );
}
