import 'server-only';
import { z } from '@/lib/validation';
import { ValidationError } from './errors';
import { fieldErrors } from './http';

/**
 * Request bodies `defineRoute` does not parse itself.
 *
 * `defineRoute({ input, query, params })` handles JSON, query strings and path
 * params. What is left:
 *
 * - `parseFormData` — file uploads (multipart).
 * - `parseAnyBody` — third-party callbacks (payment gateways) that send JSON
 *   or a form depending on configuration, sometimes with the wrong
 *   content-type.
 *
 * Both throw `ValidationError`, so inside a `defineRoute` handler the failure
 * becomes the standard 400 envelope.
 */

function parseOrThrow<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'اطلاعات ارسالی معتبر نیست',
      fieldErrors(parsed.error)
    );
  }
  return parsed.data;
}

/** Repeated keys become arrays, so `z.array(...)` works unchanged. */
function entriesToObject(entries: Iterable<[string, unknown]>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const existing = result[key];
    if (existing === undefined) result[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else result[key] = [existing, value];
  }
  return result;
}

/** A multipart or urlencoded form — file uploads. Mind the 4.5 MB Server Action body cap: large uploads stay routes. */
export async function parseFormData<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ValidationError('اطلاعات فرم ارسالی معتبر نیست');
  }
  return parseOrThrow(schema, entriesToObject(formData.entries()));
}

/** Any body, whatever its content-type claims. Only for third-party callbacks. */
export async function parseAnyBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const contentType = request.headers.get('content-type') || '';
  let raw: unknown = {};

  try {
    if (contentType.includes('multipart/form-data') || contentType.includes('x-www-form-urlencoded')) {
      raw = entriesToObject((await request.formData()).entries());
    } else {
      const text = await request.text();
      if (text.trim() !== '') {
        try {
          raw = JSON.parse(text);
        } catch {
          // Some gateways send urlencoded bodies labelled as JSON.
          raw = entriesToObject(new URLSearchParams(text).entries());
        }
      }
    }
  } catch {
    throw new ValidationError('بدنه‌ی درخواست معتبر نیست');
  }

  return parseOrThrow(schema, raw);
}
