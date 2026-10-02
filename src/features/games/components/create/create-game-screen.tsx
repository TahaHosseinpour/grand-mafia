'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconInput } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { Segmented } from '@/components/ui/segmented';
import { Stepper } from '@/components/ui/stepper';
import { Switch } from '@/components/ui/switch';
import { isLegalGameName } from '@/lib/game-constants';
import { formatNumber } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { emit } from '../socket';
import { useClientState } from '../store';
import { POWERS } from '../table/board';

/**
 * «بازی جدید»: every option the server accepts (`createGameInput`), grouped
 * so a phone user sees the common choices first and the rest on demand.
 */

type GameType = 'ranked' | 'casual' | 'practice' | 'custom';
type Chats = 'enabled' | 'emotes' | 'disabled';
type Power = keyof typeof POWERS | 'none';

const TIMERS = [0, 15, 30, 45, 60, 90, 120];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="font-display text-[1.35rem] leading-tight">{title}</h2>
      {hint ? <p className="mt-0.5 text-[0.85rem] text-fg-faint">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const defaultPowers = (players: number): Power[] =>
  players <= 6 ? ['none', 'none', 'deckpeek', 'bullet', 'bullet'] : players <= 8 ? ['none', 'investigate', 'election', 'bullet', 'bullet'] : ['investigate', 'investigate', 'election', 'bullet', 'bullet'];

export default function CreateGameScreen() {
  const me = useClientState((state) => state.userList.find((user) => user.userName === state.userInfo.userName));
  const verified = useClientState((state) => Boolean(state.userInfo.verified));
  const privateProfile = useClientState((state) => Boolean(state.userInfo.gameSettings?.isPrivate));

  const [name, setName] = useState('بازی جدید');
  const [type, setType] = useState<GameType>('ranked');
  const [minPlayers, setMinPlayers] = useState(5);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [isPrivate, setIsPrivate] = useState(privateProfile);
  const [password, setPassword] = useState('');
  const [timer, setTimer] = useState(0);
  const [chats, setChats] = useState<Chats>('enabled');
  const [rainbow, setRainbow] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [experienced, setExperienced] = useState(false);
  const [blind, setBlind] = useState(false);
  const [noGameChat, setNoGameChat] = useState(false);
  const [quietObservers, setQuietObservers] = useState(false);
  const [quietObserversInGame, setQuietObserversInGame] = useState(false);
  const [anonymousRemakes, setAnonymousRemakes] = useState(false);
  const [avalon, setAvalon] = useState<'none' | 'merlin' | 'percival'>('none');
  const [monarchist, setMonarchist] = useState(false);
  const [rebalance, setRebalance] = useState(true);
  const [noTopdecking, setNoTopdecking] = useState<0 | 1 | 2>(0);
  const [eloLimit, setEloLimit] = useState(0);
  const [xpLimit, setXpLimit] = useState(0);
  const [more, setMore] = useState(false);

  // Custom game
  const [powers, setPowers] = useState<Power[]>(defaultPowers(7));
  const [fascists, setFascists] = useState(2);
  const [hitlerZone, setHitlerZone] = useState(3);
  const [vetoZone, setVetoZone] = useState(5);
  const [deckLib, setDeckLib] = useState(6);
  const [deckFas, setDeckFas] = useState(11);
  const [startLib, setStartLib] = useState(0);
  const [startFas, setStartFas] = useState(0);
  const [hitKnowsFas, setHitKnowsFas] = useState(false);
  const [fasCanShootHit, setFasCanShootHit] = useState(false);

  const custom = type === 'custom';
  const casualLike = type === 'casual' || type === 'practice' || custom;
  const myElo = Math.floor(Math.min(me?.eloSeason ?? 1600, me?.eloOverall ?? 1600));
  const myXp = Math.floor(me?.xpOverall ?? 0);
  const busy = Boolean(me?.status && me.status.type !== 'none' && me.status.gameId);

  const problems: string[] = [];
  if (!name.trim()) problems.push('نام بازی را بنویسید.');
  else if (name.length > 20) problems.push('نام بازی حداکثر ۲۰ نویسه است.');
  else if (!isLegalGameName(name)) problems.push('نام بازی فقط می‌تواند حروف فارسی و انگلیسی، عدد و نشانه‌های ساده داشته باشد.');
  if (isPrivate && !password) problems.push('برای بازی خصوصی یک رمز بگذارید.');
  if (minPlayers > maxPlayers) problems.push('کمترین تعداد بازیکن نباید از بیشترین بیشتر باشد.');
  if (custom) {
    if (fascists + 1 > minPlayers / 2) problems.push('فاشیست‌ها (با هیتلر) نباید نیمی از بازیکنان یا بیشتر باشند.');
    if (vetoZone <= startFas) problems.push('وتو باید بعد از قوانین فاشیستیِ شروع آزاد شود.');
    if (deckLib + deckFas < 13) problems.push('دسته دست‌کم ۱۳ قانون لازم دارد.');
  }
  if (privateProfile && !isPrivate) problems.push('پروفایل شما خصوصی است؛ فقط می‌توانید بازی خصوصی بسازید.');

  const toggleExcluded = (count: number) => setExcluded((list) => (list.includes(count) ? list.filter((n) => n !== count) : [...list, count]));

  const submit = () => {
    if (problems.length) return;
    const players = custom ? minPlayers : maxPlayers;
    emit('addNewGame', {
      gameName: name.trim(),
      gameType: type,
      casualGame: type === 'casual',
      minPlayersCount: minPlayers,
      maxPlayersCount: custom ? minPlayers : maxPlayers,
      excludedPlayerCount: custom ? [] : excluded.filter((count) => count > minPlayers && count < maxPlayers),
      privatePassword: isPrivate ? password : false,
      timedMode: timer || false,
      playerChats: chats,
      rainbowgame: rainbow,
      isVerifiedOnly: verifiedOnly,
      experiencedMode: experienced,
      blindMode: blind,
      disableGamechat: noGameChat,
      disableObserverLobby: quietObservers,
      disableObserver: quietObserversInGame,
      privateAnonymousRemakes: anonymousRemakes,
      avalonSH: avalon !== 'none',
      withPercival: avalon === 'percival',
      monarchistSH: monarchist,
      rebalance6p: rebalance && players >= 6 && minPlayers <= 6,
      rebalance7p: rebalance && players >= 7 && minPlayers <= 7,
      rebalance9p2f: rebalance && players >= 9 && minPlayers <= 9,
      noTopdecking,
      eloSliderValue: eloLimit || null,
      xpSliderValue: xpLimit || null,
      customGameSettings: custom
        ? {
            enabled: true,
            deckState: { lib: deckLib, fas: deckFas },
            trackState: { lib: startLib, fas: startFas },
            fascistCount: fascists,
            hitlerZone,
            vetoZone,
            powers: powers.map((power) => (power === 'none' ? null : power)),
            hitKnowsFas,
            fasCanShootHit,
          }
        : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-4">
      <h1 className="mb-4 font-display text-[2rem] leading-tight">بازی جدید</h1>
      {busy ? <Message variant="info">شما الان در یک بازی هستید؛ برای ساختن بازی تازه اول از آن بیرون بیایید.</Message> : null}

      <div className="flex flex-col gap-4">
        <Section title="نام و نوع بازی">
          <IconInput value={name} maxLength={20} onChange={(event) => setName(event.target.value)} placeholder="نام میز" />
          <Segmented
            className="mt-3"
            ariaLabel="نوع بازی"
            value={type}
            onChange={(value) => {
              setType(value);
              if (value === 'custom') setPowers(defaultPowers(minPlayers));
              if (value !== 'casual' && value !== 'practice' && chats === 'emotes') setChats('enabled');
            }}
            options={[
              { value: 'ranked', label: 'رتبه‌ای' },
              { value: 'casual', label: 'غیررسمی' },
              { value: 'practice', label: 'تمرینی' },
              { value: 'custom', label: 'سفارشی' },
            ]}
          />
          <p className="mt-2 text-[0.85rem] text-fg-faint">
            {type === 'ranked'
              ? 'ELO و امتیاز تجربه می‌دهد. قوانین استاندارد.'
              : type === 'casual'
                ? 'بدون ELO؛ برای بازی دوستانه و حالت‌های ویژه.'
                : type === 'practice'
                  ? 'بدون ELO ولی با امتیاز تجربه؛ برای تمرین.'
                  : 'قدرت‌ها، دسته و تعداد نقش‌ها را خودتان بچینید. بدون ELO.'}
          </p>
        </Section>

        <Section title="بازیکنان" hint={custom ? 'بازی سفارشی برای یک تعداد ثابت بازیکن چیده می‌شود.' : 'بازی با رسیدن به کمترین تعداد شروع می‌شود، با پر شدن میز زودتر.'}>
          <Stepper label={custom ? 'تعداد بازیکنان' : 'کمترین'} value={minPlayers} min={5} max={10} onChange={(value) => { setMinPlayers(value); if (value > maxPlayers) setMaxPlayers(value); if (custom) setPowers(defaultPowers(value)); }} />
          {!custom ? <Stepper label="بیشترین" value={maxPlayers} min={5} max={10} onChange={(value) => { setMaxPlayers(value); if (value < minPlayers) setMinPlayers(value); }} /> : null}
          {!custom && maxPlayers - minPlayers > 1 ? (
            <div className="mt-2">
              <p className="mb-2 text-[0.85rem] text-fg-faint">با این تعدادها شروع نشود:</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: maxPlayers - minPlayers - 1 }, (_, i) => minPlayers + i + 1).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => toggleExcluded(count)}
                    className={cn('size-10 cursor-pointer rounded-xl font-bold', excluded.includes(count) ? 'bg-danger/80 text-white line-through' : 'bg-surface-3 text-fg')}
                  >
                    {formatNumber(count)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Section>

        <Section title="حریم و زمان">
          <Switch label={<span className="flex items-center gap-1.5"><Lock className="size-4 text-gold" /> بازی خصوصی</span>} hint="فقط کسانی که رمز را دارند می‌نشینند و در فهرست دیده نمی‌شود چه کسانی بازی می‌کنند." checked={isPrivate} onChange={setIsPrivate} disabled={privateProfile} />
          {isPrivate ? <IconInput className="mt-1" value={password} maxLength={50} onChange={(event) => setPassword(event.target.value)} placeholder="رمز میز" /> : null}
          <div className="mt-3">
            <p className="mb-2 text-fg">زمان هر تصمیم</p>
            <Segmented
              ariaLabel="زمان هر تصمیم"
              value={timer}
              onChange={setTimer}
              options={TIMERS.map((seconds) => ({ value: seconds, label: seconds ? formatNumber(seconds) : 'آزاد' }))}
            />
            {timer ? <p className="mt-2 text-[0.85rem] text-fg-faint">اگر کسی در {formatNumber(timer)} ثانیه تصمیم نگیرد، بازی به‌جای او تصادفی انتخاب می‌کند.{timer < 30 ? ' زمان کمتر از ۳۰ ثانیه بازی را غیررسمی می‌کند.' : ''}</p> : null}
          </div>
        </Section>

        <Section title="چت">
          <Segmented
            ariaLabel="چت بازیکنان"
            value={chats}
            onChange={setChats}
            options={[
              { value: 'enabled', label: 'آزاد' },
              { value: 'emotes', label: 'فقط ایموجی', disabled: !(type === 'casual' || type === 'practice') },
              { value: 'disabled', label: 'بی‌صدا' },
            ]}
          />
          <div className="mt-2 divide-y divide-line">
            <Switch label="پیام‌های خودکار بازی خاموش" hint="بازی رویدادها را در چت اعلام نمی‌کند." checked={noGameChat} onChange={setNoGameChat} />
            <Switch label="تماشاگران پیش از شروع پیام ندهند" checked={quietObservers} onChange={setQuietObservers} />
            <Switch label="تماشاگران در طول بازی پیام ندهند" checked={quietObserversInGame} onChange={setQuietObserversInGame} />
          </div>
        </Section>

        {!more ? (
          <Button variant="secondary" fluid onClick={() => setMore(true)}>
            گزینه‌های بیشتر
          </Button>
        ) : (
          <>
            <Section title="چه کسانی بنشینند">
              <div className="divide-y divide-line">
                <Switch label="فقط بازیکنان باتجربه" hint="کسانی که دست‌کم ۱۰ امتیاز تجربه دارند." checked={rainbow} onChange={setRainbow} disabled={!me?.isRainbowOverall} />
                <Switch label="فقط حساب‌های تأییدشده" checked={verifiedOnly} onChange={setVerifiedOnly} disabled={!verified} />
              </div>
              {me?.isRainbowOverall ? (
                <>
                  <Stepper label={`حداقل ELO ${eloLimit ? formatNumber(eloLimit) : '—'}`} value={Math.round(eloLimit / 50)} min={0} max={Math.floor(myElo / 50)} onChange={(step) => setEloLimit(step * 50)} />
                  <Stepper label={`حداقل امتیاز تجربه ${xpLimit ? formatNumber(xpLimit) : '—'}`} value={Math.round(xpLimit / 10)} min={0} max={Math.floor(myXp / 10)} onChange={(step) => setXpLimit(step * 10)} />
                </>
              ) : null}
            </Section>

            <Section title="حالت‌های بازی" hint={!casualLike ? 'بیشتر این حالت‌ها بازی را غیررسمی می‌کنند.' : undefined}>
              <div className="divide-y divide-line">
                <Switch label="سریع" hint="انیمیشن‌ها کوتاه‌تر؛ برای بازیکنان باتجربه." checked={experienced} onChange={setExperienced} />
                <Switch label="نام‌های ناشناس" hint="تا پایان بازی هر کس با یک نام ساختگی دیده می‌شود." checked={blind} onChange={setBlind} />
                {isPrivate ? <Switch label="رأی‌های ساخت دوباره بی‌نام باشد" checked={anonymousRemakes} onChange={setAnonymousRemakes} /> : null}
                <Switch label="متعادل‌سازی" hint="در ۶، ۷ و ۹ نفره تعادل دو تیم را بهتر می‌کند (مثل بازی‌های رتبه‌ای سایت اصلی)." checked={rebalance} onChange={setRebalance} />
                <Switch label="سلطنت‌طلب" hint="یک فاشیست که اگر هیتلر صدراعظم شود می‌بازد." checked={monarchist} onChange={setMonarchist} />
              </div>
              <div className="mt-3">
                <p className="mb-2 text-fg">آوالون</p>
                <Segmented
                  ariaLabel="آوالون"
                  value={avalon}
                  onChange={setAvalon}
                  options={[
                    { value: 'none', label: 'ندارد' },
                    { value: 'merlin', label: 'مرلین' },
                    { value: 'percival', label: 'مرلین و پرسیوال' },
                  ]}
                />
                {avalon !== 'none' ? <p className="mt-2 text-[0.85rem] text-fg-faint">مرلین فاشیست‌ها را می‌شناسد. اگر لیبرال‌ها ببرند، هیتلر یک بار حدس می‌زند مرلین کیست؛ درست بگوید، فاشیست‌ها می‌برند.</p> : null}
              </div>
              <div className="mt-3">
                <p className="mb-2 text-fg">تاپ‌دک (تصویب خودکار بعد از سه شکست)</p>
                <Segmented
                  ariaLabel="تاپ‌دک"
                  value={noTopdecking}
                  onChange={setNoTopdecking}
                  options={[
                    { value: 0, label: 'مجاز' },
                    { value: 2, label: 'یک بار' },
                    { value: 1, label: 'ممنوع' },
                  ]}
                />
              </div>
            </Section>
          </>
        )}

        {custom ? (
          <Section title="بازی سفارشی" hint="هر چیدمانی که بخواهید، به شرط اینکه فاشیست‌ها اکثریت نباشند.">
            <Stepper label="فاشیست‌ها (به‌جز هیتلر)" value={fascists} min={1} max={3} onChange={setFascists} />
            <Stepper label="منطقه‌ی هیتلر: بعد از چند قانون فاشیستی" value={hitlerZone} min={1} max={5} onChange={setHitlerZone} />
            <Stepper label="وتو بعد از چند قانون فاشیستی" value={vetoZone} min={1} max={5} onChange={setVetoZone} />
            <Stepper label="قانون‌های لیبرال در دسته" value={deckLib} min={5} max={8} onChange={setDeckLib} />
            <Stepper label="قانون‌های فاشیستی در دسته" value={deckFas} min={5} max={19} onChange={setDeckFas} />
            <Stepper label="قانون لیبرال تصویب‌شده در شروع" value={startLib} min={0} max={4} onChange={setStartLib} />
            <Stepper label="قانون فاشیستی تصویب‌شده در شروع" value={startFas} min={0} max={5} onChange={setStartFas} />
            <div className="mt-3 space-y-2">
              <p className="text-fg">قدرت هر خانه‌ی فاشیستی</p>
              {powers.map((power, i) => (
                <label key={i} className="flex items-center justify-between gap-3">
                  <span className="text-fg-muted">خانه‌ی {formatNumber(i + 1)}</span>
                  <select
                    value={power}
                    onChange={(event) => setPowers((list) => list.map((value, index) => (index === i ? (event.target.value as Power) : value)))}
                    className="h-10 min-w-40 cursor-pointer rounded-xl border border-line bg-surface-2 px-3 text-fg outline-none focus:border-accent"
                  >
                    <option value="none">بدون قدرت</option>
                    {Object.entries(POWERS).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.short}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 divide-y divide-line">
              <Switch label="هیتلر فاشیست‌ها را می‌شناسد" checked={hitKnowsFas} onChange={setHitKnowsFas} />
              <Switch label="فاشیست‌ها می‌توانند هیتلر را اعدام کنند" checked={fasCanShootHit} onChange={setFasCanShootHit} />
            </div>
          </Section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {problems.length ? <p className="mb-2 text-center text-[0.85rem] text-fas-soft">{problems[0]}</p> : null}
          <Button variant="primary" size="lg" fluid disabled={problems.length > 0 || busy} onClick={submit}>
            ساخت بازی
          </Button>
        </div>
      </div>
    </div>
  );
}
