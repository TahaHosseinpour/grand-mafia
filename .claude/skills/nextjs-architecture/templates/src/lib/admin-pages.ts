/**
 * Every admin page that can carry a permission, with its display label.
 *
 * `AdminPagePath` is derived from this object, so `defineAdminAction({ page })`
 * and `requireAdminPermission(page)` reject a typo at compile time.
 *
 * **These URLs are frozen.** `AdminPermission` rows are keyed on these exact
 * strings; renaming a page silently revokes every permission for it. A new
 * admin page = a new line here.
 */
export const ADMIN_PAGE_PATHS = {
  '/admin/dashboard': 'داشبورد',
  '/admin/users': 'کاربران',
  '/admin/posts': 'مطالب',
} as const;

export type AdminPagePath = keyof typeof ADMIN_PAGE_PATHS;
