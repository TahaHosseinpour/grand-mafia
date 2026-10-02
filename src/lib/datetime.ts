/**
 * Dates shown to users: Persian (Solar Hijri) calendar, Tehran time,
 * Persian digits. Every user-facing date goes through here.
 */

const TIME_ZONE = 'Asia/Tehran';

const dateTimeFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('fa-IR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** «۱۲ مهر ۱۴۰۵، ساعت ۱۴:۳۰» */
export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormat.format(new Date(value));
}

/** «۱۲ مهر ۱۴۰۵» */
export function formatDate(value: string | number | Date): string {
  return dateFormat.format(new Date(value));
}

/** «۱۴:۳۰:۰۵» — chat timestamps. */
export function formatTime(value: string | number | Date): string {
  return timeFormat.format(new Date(value));
}

/** Persian digits for a number: 1234 → «۱٬۲۳۴». */
export function formatNumber(value: number): string {
  return value.toLocaleString('fa-IR');
}
