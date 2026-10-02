/**
 * Validation — the Zod entry point and the shared schema pieces.
 *
 * Import `z` from here, never from `zod` (a lint error everywhere except this
 * file). This module switches Zod's default messages to the project locale
 * once, as a side effect of being imported; a direct `zod` import would
 * validate the same way and silently answer in English.
 *
 * Isomorphic on purpose: client forms reach it through feature `inputs.ts`
 * files, so nothing here may import server code. Request parsing that needs
 * the server lives in `@/server/request`.
 *
 *   import { z, zId, zText } from '@/lib/validation';
 *   export const createPostInput = z.object({
 *     title: zText('عنوان', { max: 200 }),
 *     categoryId: zId,
 *   });
 *
 * Mirror database limits: a `VarChar(200)` column gets `.max(200)`, so long
 * input is a 400 rather than a 500. Never derive input schemas from the
 * Prisma model — that is mass assignment (a client sends `role: 'admin'`).
 */

import { z } from 'zod';

// Persian messages. Swap the locale for a non-Persian project.
z.config(z.locales.fa());

export { z };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Persian/Arabic digits to Latin, so «۰۹۱۲…» passes a `\d` regex. */
export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex > -1) return String(persianIndex);
    return String(ARABIC_DIGITS.indexOf(char));
  });
}

/** Forms send both `''` and `null` for an untouched field; both mean "not sent". */
export const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

/** `''` becomes null — "clear this column". */
export const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Optional version of a schema: `''`, `null` and missing all become undefined.
 *
 * The outer `.optional()` matters: `z.preprocess` declares its input as
 * `unknown`, and an `unknown` key is *required* in `z.input`. Without it a
 * Server Action (typed from `z.input`) would demand a field the schema itself
 * treats as optional.
 */
export function zOptional<S extends z.ZodType>(schema: S) {
  return z.preprocess(emptyToUndefined, schema.optional()).optional();
}

/** Nullable version: `''`/`null` → null ("clear it"), missing → undefined ("leave it"). */
export function zNullish<S extends z.ZodType>(schema: S) {
  return z.preprocess(emptyToNull, schema.nullish()).optional();
}

/* -------------------------------------------------------------------------- */
/*  Ids and slugs                                                              */
/* -------------------------------------------------------------------------- */

/** A numeric database id; the string «12» is accepted. */
export const zId = z.coerce.number('شناسه نامعتبر است').int('شناسه نامعتبر است').positive('شناسه نامعتبر است');
export const zOptionalId = zOptional(zId);
export const zNullableId = zNullish(zId);

/** Route params: `defineRoute({ params: zIdParams() })`. */
export const zIdParams = (key = 'id') => z.object({ [key]: zId } as Record<string, typeof zId>);

export const zSlug = z
  .string('اسلاگ الزامی است')
  .trim()
  .min(1, 'اسلاگ الزامی است')
  .max(200, 'اسلاگ بیش از حد طولانی است')
  .regex(/^[^\s/?#]+$/, 'اسلاگ نامعتبر است');

export const zSlugParams = (key = 'slug') => z.object({ [key]: zSlug } as Record<string, typeof zSlug>);

/* -------------------------------------------------------------------------- */
/*  Text                                                                       */
/* -------------------------------------------------------------------------- */

interface TextOptions {
  min?: number;
  max?: number;
}

/** Required, trimmed text with a named message. `label` is the field name the user sees. */
export function zText(label: string, options: TextOptions = {}) {
  const { min = 1, max = 5000 } = options;
  return z
    .string(`${label} الزامی است`)
    .trim()
    .min(min, min === 1 ? `${label} الزامی است` : `${label} باید حداقل ${min} کاراکتر باشد`)
    .max(max, `${label} باید حداکثر ${max} کاراکتر باشد`);
}

export function zOptionalText(label: string, options: TextOptions = {}) {
  return zOptional(zText(label, options));
}

export function zNullableText(label: string, options: TextOptions = {}) {
  return zNullish(zText(label, options));
}

/* -------------------------------------------------------------------------- */
/*  Identity                                                                   */
/* -------------------------------------------------------------------------- */

/** Iranian mobile; Persian digits, spaces and dashes are normalised. */
export const zMobile = z
  .string('شماره موبایل الزامی است')
  .transform((value) => normalizeDigits(value).replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(/^09\d{9}$/, 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'));

export const zEmail = z.string('ایمیل الزامی است').trim().pipe(z.email('فرمت ایمیل صحیح نیست'));
export const zOptionalEmail = zOptional(zEmail);

/** 8+ chars with a letter and a digit; capped at bcrypt's 72 bytes. */
export const zPassword = z
  .string('رمز عبور الزامی است')
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'رمز عبور بیش از حد طولانی است')
  .refine((value) => /\d/.test(value), 'رمز عبور باید حداقل یک عدد داشته باشد')
  .refine((value) => /[a-zA-Z]/.test(value), 'رمز عبور باید حداقل یک حرف داشته باشد');

/** A 6-digit one-time code. */
export const zOtp = z
  .string('کد تایید الزامی است')
  .transform((value) => normalizeDigits(value).trim())
  .pipe(z.string().regex(/^\d{6}$/, 'کد تایید باید ۶ رقم باشد'));

/* -------------------------------------------------------------------------- */
/*  Links                                                                      */
/* -------------------------------------------------------------------------- */

/** An absolute URL (https://…) or an internal path (/uploads/…). */
export const zLink = z
  .string('آدرس الزامی است')
  .trim()
  .max(2048, 'آدرس بیش از حد طولانی است')
  .regex(/^(https?:\/\/\S+|\/\S*)$/, 'آدرس معتبر نیست');
export const zOptionalLink = zOptional(zLink);
export const zNullableLink = zNullish(zLink);

/* -------------------------------------------------------------------------- */
/*  Numbers, booleans, dates                                                   */
/* -------------------------------------------------------------------------- */

/** Non-negative integer: order, capacity, counts. */
export const zCount = z.coerce.number('عدد نامعتبر است').int('عدد باید صحیح باشد').min(0, 'عدد نمی‌تواند منفی باشد');

/** Money in the project's single currency unit (decide it once, e.g. tomans). */
export const zAmount = z.coerce.number('مبلغ نامعتبر است').min(0, 'مبلغ نمی‌تواند منفی باشد');

/** Accepts «true»/«false»/«1»/«0»/«on» from query strings and forms. */
export const zBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return value;
}, z.boolean('مقدار باید بله یا خیر باشد'));

/** ISO string or timestamp → `Date`. Input stays a string in `z.input`. */
export const zDate = z.coerce.date('تاریخ نامعتبر است');
export const zOptionalDate = zOptional(zDate);
export const zNullableDate = zNullish(zDate);

/* -------------------------------------------------------------------------- */
/*  Lists                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Standard pagination. A junk value falls back to the default instead of a
 * 400; a `limit` above `maxLimit` is **clamped**, not reset to the default
 * (otherwise asking for more returns fewer). A picker that needs every option
 * calls an unpaginated list function instead of `limit: 1000`.
 */
export function zPagination(defaultLimit = 20, maxLimit = 100) {
  return z.object({
    page: z.coerce.number().int().min(1).catch(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .catch(defaultLimit)
      .default(defaultLimit)
      .transform((value) => Math.min(value, maxLimit)),
  });
}

/** Search term; empty = no filter. */
export const zSearch = z
  .preprocess(emptyToUndefined, z.string().trim().max(200, 'عبارت جست‌وجو بیش از حد طولانی است').optional())
  .optional();

/** Ids as an array or a «1,2,3» query string. */
export const zIdList = z.preprocess((value) => {
  if (typeof value === 'string') return value.split(',').map((p) => p.trim()).filter(Boolean);
  return value;
}, z.array(zId));
