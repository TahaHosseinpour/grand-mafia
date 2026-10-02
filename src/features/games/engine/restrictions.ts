import {
  acceptTermsForRealtime,
  acknowledgeWarningForRealtime,
  findUnacknowledgedWarningForRealtime,
  loadPresenceForRealtime,
  secondLastFeedbackAtForRealtime,
  submitFeedbackForRealtime,
} from '@/features/users';
import { LATEST_TOU_VERSION, pendingTouChanges } from '@/lib/tou';
import { rootLogger } from '@/server/logger';
import type { HubSocket } from './hub';

/**
 * What stops a player from playing until they act: new terms of use to agree
 * to, and moderator warnings to acknowledge (legacy `checkRestriction`). The
 * realtime layer keeps the result per connection and refuses game events
 * while it is true.
 */

const log = rootLogger.child({ module: 'engine.restrictions' });

/**
 * Shows the player their next pending popup, or clears popups when there is
 * none. Returns true while the player is restricted.
 */
export async function checkRestriction(socket: HubSocket): Promise<boolean> {
  if (!socket.username) return false;
  try {
    const account = await loadPresenceForRealtime(socket.username);
    if (!account) return false;

    const changes = pendingTouChanges(account.touLastAgreed);
    if (changes.length > 0) {
      socket.emit('touChange', changes);
      return true;
    }

    const warning = await findUnacknowledgedWarningForRealtime(socket.username);
    if (warning) {
      socket.emit('warningPopup', { text: warning.text, time: warning.time });
      return true;
    }

    socket.emit('removeAllPopups');
    return false;
  } catch (error) {
    log.error({ err: error, user: socket.username }, 'checking restrictions failed');
    return false;
  }
}

/** The player agreed to the current terms of use; returns whether they are still restricted. */
export async function confirmTerms(socket: HubSocket): Promise<boolean> {
  if (!socket.username) return false;
  await acceptTermsForRealtime(socket.username, LATEST_TOU_VERSION);
  return checkRestriction(socket);
}

/** The player read their oldest unread warning; returns whether they are still restricted. */
export async function acknowledgeWarning(socket: HubSocket): Promise<boolean> {
  if (!socket.username) return false;
  await acknowledgeWarningForRealtime(socket.username);
  return checkRestriction(socket);
}

/* ------------------------------------------------------------------ */
/*  Feedback                                                           */
/* ------------------------------------------------------------------ */

const FEEDBACK_MAX_LENGTH = 1900;
const DAY_MS = 24 * 60 * 60 * 1000;

/** «۲ ساعت و ۱۵ دقیقه» for a wait of `ms` (at least one minute). */
function describeWait(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const format = new Intl.NumberFormat('fa-IR');
  const parts: string[] = [];
  if (hours) parts.push(`${format.format(hours)} ساعت`);
  if (minutes) parts.push(`${format.format(minutes)} دقیقه`);
  return parts.join(' و ');
}

type FeedbackReply = { status: 'success' | 'error'; message: string };

export async function handleFeedbackForm(socket: HubSocket, raw: unknown): Promise<void> {
  const reply = (response: FeedbackReply) => socket.emit('feedbackResponse', response);

  if (!socket.username) return reply({ status: 'error', message: 'شما وارد حساب خود نشده‌اید.' });

  const feedback = raw && typeof raw === 'object' ? (raw as { feedback?: unknown }).feedback : undefined;
  if (!feedback) return reply({ status: 'error', message: 'نمی‌توانید بازخورد خالی بفرستید.' });
  if (typeof feedback !== 'string') return;
  if (feedback.length > FEEDBACK_MAX_LENGTH) return reply({ status: 'error', message: 'بازخورد شما بیش از حد طولانی است.' });

  try {
    // Two submissions a day: the second most recent one must be older than 24 hours.
    const secondLast = await secondLastFeedbackAtForRealtime(socket.username);
    if (secondLast && Date.now() - secondLast.getTime() <= DAY_MS) {
      const wait = DAY_MS - (Date.now() - secondLast.getTime());
      return reply({ status: 'error', message: `هر روز فقط دو بار می‌توانید بازخورد بفرستید. ${describeWait(wait)} دیگر می‌توانید دوباره بفرستید.` });
    }

    await submitFeedbackForRealtime(socket.username, feedback);
    reply({ status: 'success', message: 'از ارسال بازخورد شما سپاسگزاریم!' });
  } catch (error) {
    log.error({ err: error, user: socket.username }, 'saving feedback failed');
    reply({ status: 'error', message: 'خطای ناشناخته‌ای رخ داد.' });
  }
}
