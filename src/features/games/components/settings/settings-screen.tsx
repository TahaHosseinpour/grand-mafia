'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconInput, fieldClasses } from '@/components/ui/icon-input';
import { Message } from '@/components/ui/message';
import { Modal } from '@/components/ui/modal';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { formatDate } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { saveSettings } from '../common/save-settings';
import { emit } from '../socket';
import { useClientState } from '../store';

/** The player's preferences (legacy Settings.jsx), saved as they change. */

const PRONOUNS = [
  { value: '', label: 'نگفتن' },
  { value: 'he/him/his', label: 'او (آقا)' },
  { value: 'she/her/hers', label: 'او (خانم)' },
  { value: 'they/them/theirs', label: 'ترجیح نمی‌دهم' },
  { value: 'Any Pronouns', label: 'هر کدام' },
];

const PRIVATE_COOLDOWN_MS = 18 * 60 * 60 * 1000;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="mb-1 font-display text-[1.35rem]">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Blacklist() {
  const list = useClientState((state) => state.userInfo.gameSettings?.blacklist ?? []);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const full = list.length >= 30;

  const add = () => {
    const userName = name.trim();
    if (!userName || full || list.some((entry) => entry.userName === userName)) return;
    saveSettings({ blacklist: [...list, { userName, reason: reason.trim(), timestamp: Date.now() }] });
    setName('');
    setReason('');
  };

  return (
    <div className="pt-2">
      <p className="mb-3 text-[0.85rem] text-fg-faint">بازیکنانی که در بازی‌هایی که می‌سازید نمی‌توانند بنشینند (حداکثر ۳۰ نفر).</p>
      <ul className="mb-3 flex flex-col gap-1.5">
        {list.map((entry) => (
          <li key={entry.userName} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
            <span className="min-w-0">
              <span className="block font-bold" dir="auto">
                {entry.userName}
              </span>
              <span className="block truncate text-[0.8rem] text-fg-faint">
                {entry.reason || 'بدون توضیح'} — {formatDate(entry.timestamp)}
              </span>
            </span>
            <button
              type="button"
              aria-label={`برداشتن ${entry.userName}`}
              onClick={() => saveSettings({ blacklist: list.filter((item) => item.userName !== entry.userName) })}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-faint hover:bg-danger/15 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {list.length === 0 ? <li className="py-2 text-center text-fg-faint">فهرست سیاه شما خالی است.</li> : null}
      </ul>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <IconInput value={name} onChange={(event) => setName(event.target.value)} placeholder="نام کاربری" maxLength={16} disabled={full} />
        <IconInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="دلیل (اختیاری)" maxLength={100} disabled={full} />
        <Button type="submit" variant="secondary" disabled={!name.trim() || full} className="shrink-0">
          افزودن
        </Button>
      </form>
    </div>
  );
}

function Bio() {
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        emit('updateBio', bio);
        setSaved(true);
      }}
    >
      <textarea
        value={bio}
        maxLength={500}
        rows={3}
        dir="auto"
        onChange={(event) => {
          setBio(event.target.value);
          setSaved(false);
        }}
        placeholder="چند کلمه درباره‌ی خودتان (در پروفایل‌تان دیده می‌شود)"
        className={cn(fieldClasses, 'resize-none py-3')}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[0.8rem] text-fg-faint">{saved ? 'ذخیره شد.' : `${bio.length.toLocaleString('fa-IR')} از ۵۰۰`}</span>
        <Button type="submit" variant="secondary" size="sm">
          ذخیره‌ی درباره‌ی من
        </Button>
      </div>
    </form>
  );
}

export default function SettingsScreen() {
  const settings = useClientState((state) => state.userInfo.gameSettings) ?? {};
  const staffRole = useClientState((state) => state.userInfo.staffRole);
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  // When the screen opened: close enough to decide whether the 18-hour lock is still on.
  const [openedAt] = useState(Date.now);
  const fullStaff = staffRole === 'admin' || staffRole === 'editor' || staffRole === 'moderator';
  const canColour = fullStaff || staffRole === 'veteran';
  const privateLocked = Boolean(settings.privateToggleTime && openedAt - settings.privateToggleTime < PRIVATE_COOLDOWN_MS);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-16 pt-4">
      <h1 className="font-display text-[2rem] leading-tight">تنظیمات</h1>

      <Section title="نمایش">
        <Switch label="ساعت کنار پیام‌ها" checked={Boolean(settings.enableTimestamps)} onChange={(value) => saveSettings({ enableTimestamps: value })} />
        <Switch label="رنگ نام بازیکنان در چت" checked={!settings.disablePlayerColorsInChat} onChange={(value) => saveSettings({ disablePlayerColorsInChat: !value })} />
        <Switch label="نمایش ELO" hint="خاموش باشد، رنگ نام‌ها بر اساس تجربه و نرخ برد است." checked={!settings.disableElo} onChange={(value) => saveSettings({ disableElo: !value })} />
        <div className="py-3">
          <p className="mb-2 text-fg">آمار بازیکنان</p>
          <Segmented
            ariaLabel="آمار بازیکنان"
            value={settings.disableSeasonal ? 'overall' : 'season'}
            onChange={(value) => saveSettings({ disableSeasonal: value === 'overall' })}
            options={[
              { value: 'season', label: 'فصل جاری' },
              { value: 'overall', label: 'همه‌ی زمان‌ها' },
            ]}
          />
        </div>
        <Switch label="حالت محیط کار" hint="نام سایت در بالای صفحه و عنوان مرورگر خنثی می‌شود." checked={Boolean(settings.safeForWork)} onChange={(value) => saveSettings({ safeForWork: value })} />
      </Section>

      <Section title="بازی">
        <Switch label="لرزش گوشی وقتی نوبت شماست" checked={settings.soundStatus !== 'Off'} onChange={(value) => saveSettings({ soundStatus: value ? 'pack2' : 'Off' })} />
        <Switch label="خبرم کن وقتی بازی تازه‌ای ساخته شد" checked={Boolean(settings.notifyForNewLobby)} onChange={(value) => saveSettings({ notifyForNewLobby: value })} />
      </Section>

      <Section title="حساب">
        <Switch
          label="پروفایل خصوصی"
          hint={
            privateLocked
              ? 'این تنظیم را تا ۱۸ ساعت پس از آخرین تغییر نمی‌توانید عوض کنید.'
              : 'با پروفایل خصوصی فقط در بازی‌های خصوصی بازی می‌کنید و نامتان برای دیگران پنهان می‌ماند. هر ۱۸ ساعت یک بار می‌توانید آن را عوض کنید.'
          }
          checked={Boolean(settings.isPrivate)}
          disabled={privateLocked}
          onChange={() => setConfirmPrivate(true)}
        />
        <div className="py-3">
          <p className="mb-2 text-fg">ضمیر</p>
          <Segmented
            ariaLabel="ضمیر"
            className="flex-wrap"
            value={settings.playerPronouns ?? ''}
            onChange={(value) => saveSettings({ playerPronouns: value })}
            options={PRONOUNS}
          />
        </div>
        <div className="py-3">
          <p className="text-fg">درباره‌ی من</p>
          <Bio />
        </div>
      </Section>

      <Section title="فهرست سیاه">
        <Blacklist />
      </Section>

      {canColour ? (
        <Section title="کادر سایت">
          <Switch label="رنگ کادر روی نام من" checked={!settings.staffDisableStaffColor} onChange={(value) => saveSettings({ staffDisableStaffColor: !value })} />
          <Switch label="ELO من دیده شود" checked={!settings.staffDisableVisibleElo} onChange={(value) => saveSettings({ staffDisableVisibleElo: !value })} />
          <Switch label="امتیاز تجربه‌ی من دیده شود" checked={!settings.staffDisableVisibleXP} onChange={(value) => saveSettings({ staffDisableVisibleXP: !value })} />
          {fullStaff ? (
            <Switch label="ناشناس" hint="در فهرست بازیکنان دیده نمی‌شوید و پیام‌هایتان بی‌نام است." checked={Boolean(settings.staffIncognito)} onChange={(value) => saveSettings({ staffIncognito: value })} />
          ) : null}
        </Section>
      ) : null}

      <Modal open={confirmPrivate} onClose={() => setConfirmPrivate(false)} title={settings.isPrivate ? 'پروفایل عمومی؟' : 'پروفایل خصوصی؟'}>
        <Message variant="info" className="mt-0">
          تا ۱۸ ساعت نمی‌توانید دوباره آن را تغییر دهید. برای اعمال تغییر، اتصال شما یک بار قطع می‌شود و دوباره وارد لابی می‌شوید.
        </Message>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmPrivate(false)}>
            انصراف
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirmPrivate(false);
              emit('updateGameSettings', { isPrivate: !settings.isPrivate });
            }}
          >
            تغییر بده
          </Button>
        </div>
      </Modal>
    </div>
  );
}
