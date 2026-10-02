/**
 * Shared types for the server layer.
 */

/**
 * A page of results. Every `list<X>s` in a dal returns this.
 *
 * A `type` alias, not an `interface`: only a type alias gets an implicit index
 * signature, so only a type alias can pass the `Serializable` check below.
 */
export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Derived, so callers never recompute it inconsistently. */
  totalPages: number;
};

export function paged<T>(items: T[], total: number, page: number, pageSize: number): Paged<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

/**
 * What a DTO may contain: plain data only.
 *
 * Every DTO in a feature's `types.ts` is checked against this:
 *
 *     type AssertSerializable<T extends Serializable> = T;
 *     type _PlainDataChecks = [AssertSerializable<PostDTO>, …];
 *
 * A `Date`, a `Decimal` or a `Prisma.` type in a DTO is then a compile error.
 * That matters most for `Date`: moving a read from a route (JSON — dates
 * arrive as strings) to a Server Action (dates arrive as `Date`) otherwise
 * flips the runtime type under every `new Date(x.startsAt)` with no type error.
 *
 * DTOs must be `type` aliases — an `interface` never satisfies this, so the
 * check would silently do nothing.
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

/**
 * What every Server Action returns.
 *
 * Deliberately a different shape from the routes' `{ success, data }`: a
 * component moved from `fetch` to an action cannot keep reading `.success`
 * without a type error.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; details?: Record<string, string[]> };
