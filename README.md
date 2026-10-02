# گرند مافیا — هیتلر مخفی (نسخه فارسی)

نسخه فارسی و آنلاین بازی رومیزی «هیتلر مخفی»، بر پایه‌ی پروژه‌ی متن‌باز
[Secret Hitler.io](https://github.com/cozuya/secret-hitler) که روی Next.js
بازنویسی می‌شود.

> وضعیت: در حال مهاجرت از نسخه‌ی قدیمی (پوشه‌ی `legacy/`). مراحل و وضعیت در
> [`docs/migration.md`](docs/migration.md).

## تکنولوژی

Next.js 16 · TypeScript · Prisma 7 + PostgreSQL · Tailwind CSS 4 · Socket.IO 4 · فونت وزیرمتن

## اجرا در حالت توسعه

پیش‌نیازها: Node.js 22.15 به بالا، pnpm، PostgreSQL.

```bash
pnpm install
cp .env.example .env        # مقادیر را پر کنید
pnpm db:migrate             # ساخت جدول‌ها
pnpm dev                    # http://localhost:3000
```

## دیپلوی روی VPS

```bash
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
pnpm start                  # پشت nginx؛ هدر X-Real-IP را nginx بازنویسی کند
```

بازی‌های در جریان در حافظه‌ی پروسه نگه داشته می‌شوند: فقط **یک** نمونه اجرا کنید و
در ساعت کم‌ترافیک دیپلوی کنید (ری‌استارت، بازی‌های در جریان را از بین می‌برد).
وضعیت سرویس: `GET /api/health`.

## قوانین توسعه

[`AGENTS.md`](AGENTS.md) و پوشه‌ی [`docs/`](docs/).

## مجوز

این پروژه مانند پروژه‌ی اصلی و خود بازی تحت مجوز
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) است:
استفاده‌ی تجاری مجاز نیست و نسخه‌های مشتق باید با همین مجوز منتشر شوند.
بازی «Secret Hitler» طراحی Max Temkin، Mike Boxleiter و Tommy Maranges با تصویرسازی
Mackenzie Schubert است.
