/**
 * Canned answers: a short trigger word typed alone («veto», «وتو») is replaced
 * by a standard explanation (legacy `chatReplacements.js`). Each has a
 * cooldown, longer for ordinary players, who also need some games played
 * before they may use them. Triggers work in English (as before) and Persian.
 *
 * Id 0 is reserved: the cooldown array keeps the time of the last
 * replacement of any kind in its slot 0.
 */

export type ChatReplacement = {
  id: number;
  regex: RegExp;
  replacement: string;
  aemCooldown: number;
  normalCooldown: number;
  normalGames: number;
};

const AEM = 15;

export const chatReplacements: ChatReplacement[] = [
  {
    id: 1,
    regex: /^(r.ainbow|رنگین.?کمان)/i,
    replacement:
      'برای داشتن نام رنگی و بازی در بازی‌های «باتجربه»، باید ۱۰ امتیاز تجربه (XP) کسب کنید که از بازی‌های استاندارد (غیررسمی نباشد، خصوصی نباشد، سفارشی نباشد و فهرست‌شده باشد) به دست می‌آید. برای دیدن XP باقی‌مانده، پروفایل خود را ببینید!',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 2,
    regex: /^(o.verall|کل)/i,
    replacement:
      'اگر ۱۰ XP دارید ولی هنوز نامتان خاکستری است، شاید Elo فصلی روشن باشد که با هر فصل جدید صفر می‌شود. برای دیدن Elo کل، در تنظیمات گزینه‌ی «نمایش درصد برد و رنگ‌های کل» را روشن کنید.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 3,
    regex: /^(mod.support|پشتیبانی)/i,
    replacement:
      'ساده‌ترین راه تماس با مدیران این است که در بازی بنویسید @mod و بعد پیامتان را، یا بازیکن را با دکمه‌ی «گزارش» گزارش دهید. لینک بازی و تصویر را در صورت امکان بفرستید.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 4,
    regex: /^(v.eto|وتو)/i,
    replacement:
      'وتو پس از تصویب پنجمین قانون فاشیستی فعال می‌شود. این قدرت اجازه می‌دهد قانونِ در شُرُف تصویب باطل شود — اما فقط اگر هم رئیس‌جمهور و هم صدراعظم «آری» بدهند. اگر یکی از آن‌ها «نه» بدهد، قانون طبق روال تصویب می‌شود.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 5,
    regex: /^(a.fk|غیبت)/i,
    replacement:
      'اگر کسی غایب (AFK) به نظر می‌رسد، حتماً او را گزارش کنید و پیش از رها کردن یا ساختن دوباره‌ی بازی ۳ دقیقه صبر کنید. مدیران گاهی می‌توانند کمک کنند بازی تمام شود یا برای اقدام مناسب مدرک جمع کنند.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 6,
    regex: /^(d.iscard|دورریز)/i,
    replacement:
      'وقتی در دولت هستید یا رئیس‌جمهورید یا صدراعظم. رئیس‌جمهور ۳ کارت می‌گیرد و کارتی را که نمی‌خواهد تصویب شود دور می‌اندازد. صدراعظم ۲ کارت می‌گیرد و کارتی را که می‌خواهد تصویب شود انتخاب می‌کند.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 7,
    regex: /^(l.ag|کندی)$/i,
    replacement:
      'اگر بازی کند است، «طول چت کوتاه‌شده» را در تنظیمات کمتر کنید. هرچه عدد کمتر باشد، چت کمتری می‌بینید و کندی کمتر می‌شود.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 8,
    regex: /^(b.lacklist|فهرست.?سیاه)/i,
    replacement:
      'برای اضافه کردن بازیکن به فهرست سیاه، پروفایلش را باز کنید (با زدن روی نامش در نوار کناری یا جست‌وجوی نامش در تنظیمات) و روی «افزودن به فهرست سیاه» بزنید. لطفاً در بازی‌ها به فهرست سیاه تهدید یا اشاره نکنید.',
    aemCooldown: AEM,
    normalCooldown: 120,
    normalGames: 999999999,
  },
  {
    id: 9,
    regex: /^(r.emake|ساخت.?دوباره)$/i,
    replacement:
      'برای رأی به ساختن دوباره‌ی بازی، روی نماد :remake: در سمت چپ‌وسط صفحه، بالای بازیکن صندلی ۱ بزنید.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 10,
    regex: /^(a.valon|آوالون)$/i,
    replacement:
      'در حالت آوالون، پس از تصویب ۵ قانون لیبرال یا اعدام هیتلر، هیتلر می‌تواند مرلین را حدس بزند و با حدس درست برنده شود. سازنده‌ی بازی می‌تواند پرسیوال و مورگانا را هم اضافه کند.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 11,
    regex: /^(p.ercival|پرسیوال)$/i,
    replacement: 'پرسیوال نقشی لیبرال است که مرلین و مورگانا را می‌شناسد، اما نمی‌داند کدام کدام است.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 12,
    regex: /^(m.erlin|مرلین)$/i,
    replacement: 'مرلین نقشی لیبرال است که فاشیست‌ها را می‌شناسد، اما نقش دقیقشان را نمی‌داند.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
  {
    id: 13,
    regex: /^(m.organa|مورگانا)$/i,
    replacement: 'مورگانا نقشی فاشیستی است (هیتلر نمی‌شود) که برای پرسیوال شبیه نامزد مرلین دیده می‌شود.',
    aemCooldown: AEM,
    normalCooldown: 180,
    normalGames: 50,
  },
];
