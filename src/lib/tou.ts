/**
 * Versions of the terms of use (legacy `TOU_CHANGES` in `node-constants.js`),
 * newest first. A player who last agreed to an older version is shown what
 * changed since, and cannot play until they agree. A new player is shown the
 * oldest entry: the short list of basic rules.
 */

export type TouChange = { changeVer: string; changeDesc: string };

export const TOU_CHANGES: readonly TouChange[] = [
  {
    changeVer: '1.5',
    changeDesc:
      'به قوانین، حالت جدید «تمرینی» اضافه شد و قوانین حالت «غیررسمی» دوباره تعریف شد.\nقوانین سخنان نفرت‌آمیز شامل زبان تحقیرآمیز علیه افراد تراجنسیتی و ناتوان هم شد.\nقانون تشویق یا تمجید آسیب جسمی شفاف‌تر شد.\nقانون مربوط به «میمون» خواندن بازیکنان کمی تعدیل شد.\nقانون افشای اطلاعات شخصی کمی تعدیل شد.\nقوانین پشت کارت‌ها شفاف‌تر شد.\nقانون کش‌دادن بازی کمی بازتعریف شد.\nقوانین مربوط به اشاره به فهرست سیاه، درخواست‌های جعلی بازسازی و تهدید به درخواست بازسازی بیشتر روی تأثیرگذاری بر روند بازی متمرکز شد.\nنشستن پشت یک بازی با یک حساب و صحبت‌کردن با حساب دیگر ممنوع شد.\nجدول تخلف‌ها و مجازات‌های پیشنهادی بازنویسی شد.\nچند بازنویسی و بازچینش دیگر.',
  },
  {
    changeVer: '1.4',
    changeDesc:
      'برای بیشتر تخلف‌ها مجازات مشخص تعیین شد.\nقوانین مربوط به لو دادن داستان فیلم و سریال به‌روز شد.\nقوانین مربوط به عنوان اتاق‌ها به‌روز شد.\nقوانین مربوط به کلیک اشتباهی به‌روز شد.\nهمه‌ی قوانین با جزئیات در شرایط استفاده آمده است (پیوند زیر).',
  },
  {
    changeVer: '1.3',
    changeDesc:
      'برای ترک بازی با عصبانیت و چندحسابی یا تبانی مجازات مشخص تعیین شد.\nقوانین مربوط به بازی ضعیف‌تر از توان بازنویسی شد.\nقوانین مربوط به تأثیر ناعادلانه‌ی بیرون از بازی (تهدید با فهرست سیاه، تهدید به گزارش و مانند آن) شفاف شد.\nقوانین مربوط به لو دادن داستان فیلم و سریال اضافه شد.\nزمان‌بندی و روال کلی مجازات‌ها اضافه شد.\nسیاست غیبت (AFK) و مجازات‌های آن اضافه شد.\n',
  },
  {
    changeVer: '1.2',
    changeDesc: 'در شرایط استفاده آمد که واژه‌های ممنوع می‌تواند بدون گزارش هم به اقدام مدیران منجر شود.',
  },
  {
    changeVer: '1.1',
    changeDesc:
      'دروغ گفتن در نقش آزادی‌خواه اگر ثابت شود به نفع تیم است مجاز است.\nدنبال‌کردن بازیکنان برای اظهارنظر درباره‌ی بازی‌شان یا صحبت درباره‌ی بازی بدون گفتگو صریحاً ممنوع شد.\nتغییرات جزئی در عبارت‌های زبان ممنوع و پشت کارت‌ها.',
  },
  {
    changeVer: '1.0',
    changeDesc: 'شرایط استفاده کاملاً بازنویسی شد تا روشن‌تر باشد.',
  },
  {
    changeVer: '0.0',
    changeDesc:
      'در نقش خودتان بازی کنید و سعی کنید برنده شوید\nتأثیر ناعادلانه نگذارید: به‌عنوان یک نقش قولی ندهید که در نقش دیگر نتوانید به آن عمل کنید\nتقلب نکنید\nسخنان نفرت‌آمیز و زبان توهین‌آمیز، جنسیت‌زده، نژادپرستانه یا تبعیض‌آمیز ممنوع است\nبه دیگران احترام بگذارید\nتلاش برای آسیب‌زدن به سایت، با هک، حمله‌ی DDoS یا هر کار مخرب دیگر ممنوع است\nتلاش برای دور زدن قوانین یا مجازات‌ها ممنوع است\n',
  },
];

/** `"1.10"` to `[1, 10]`. */
/** The version a player agrees to when they accept. */
export const LATEST_TOU_VERSION = TOU_CHANGES[0].changeVer;

const parseVersion = (version: string): number[] => version.split('.').map((part) => Number.parseInt(part, 10));

/** True when `agreed` is at least as new as `change` (legacy `firstVerNew`). */
function isAtLeast(agreed: number[], change: number[]): boolean {
  for (let i = 0; i < Math.max(agreed.length, change.length); i += 1) {
    if (!change[i]) return true;
    if (!agreed[i] || Number.isNaN(agreed[i]) || agreed[i] < change[i]) return false;
    if (agreed[i] > change[i]) return true;
  }
  return true;
}

/**
 * The terms changes a player has not agreed to yet: everything newer than the
 * version they last accepted, or the basic rules if they never accepted any.
 */
export function pendingTouChanges(touLastAgreed: string | null | undefined): TouChange[] {
  if (!touLastAgreed) return [TOU_CHANGES[TOU_CHANGES.length - 1]];
  const agreed = parseVersion(touLastAgreed);
  return TOU_CHANGES.filter((change) => !isAtLeast(agreed, parseVersion(change.changeVer)));
}
