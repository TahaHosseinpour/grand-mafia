# UI and the design system

How UI is built: a local component library, a live preview of it, tokens,
and conventions. Copy into a project as `docs/design.md` and fill in its
library, brand colours, font and any RTL specifics.

**The UI library and styling stack are the project's choice** — shadcn/ui,
Radix primitives, Mantine, Chakra, MUI, Ark, hand-built components; Tailwind,
CSS Modules, vanilla-extract, plain CSS. The architecture does not depend on
any of them. What it asks for is the *discipline* below, whatever the
library: one local component layer, a preview of it, tokens instead of
values, and one way to do each recurring thing. Ask the user which stack a
new project uses; never install one by default.

## The short version

1. **Reach for `src/components/ui` first.** Whatever the library, the
   project's own wrappers/components live there, customised for the project.
   Match the local file, not the library's website.
2. **Look at the component preview before you build** (`/design-system` or
   Storybook). Every registered component renders there with its real
   variants — what you see is what ships.
3. **Tokens, not values.** Semantic variables and named brand colours; no
   raw hex and no ad-hoc palette colours in new code.
4. **Never edit the token files (theme config, global CSS) to style one
   thing.** A token change is a design decision — ask first.

## Where things live

| Path | Holds |
|---|---|
| `src/components/ui/` | the library layer — kebab-case files, named exports, variants defined in one place (e.g. `cva` with Tailwind, a variants map with CSS Modules) |
| `src/components/ui/field-styles.*` | the one surface every form control shares (optional, recommended) |
| `src/components/<pattern>/` (`cards`, `admin`, `layout`) | product patterns several features use |
| `src/features/<name>/components/` | a feature's own screens, composed from the above |
| library config (`components.json` for shadcn, a theme file for Mantine/Chakra/MUI) | the library's own setup |

## The component preview

Either Storybook, or (no extra tooling) an internal `/design-system` route
(`noindex`, no site chrome) as described here:

| URL | Shows |
|---|---|
| `/design-system` | every registered component, grouped by tier |
| `/design-system/<id>` | one component: file, exports, variant props, live demos |
| `/design-system/tokens` | colours, semantic tokens, type scale, radius, breakpoints |

- `src/app/design-system/_registry/meta.ts` is the single source of truth:
  one `ComponentMeta` per component — `id`, `name`, `description`, `tier`,
  `group`, `file`, `exports`, `variants`. No JSX, so server and client can
  import it.
- Demos in `_registry/demos/*.tsx`, one object per file keyed by `id`,
  merged in `demos/index.ts`. A demo renders the **real** component — never
  a fork or a restyle.
- Tiers: `primitive` (one element: Button, Badge, Input), `composite`
  (several parts: Card, Table, Select, Tabs, ResponsiveDialog), `special`
  (domain-bound or heavy: date picker, upload, markdown viewer), `pattern`
  (finished product blocks: cards, admin detail layout).
- **Every file in `components/ui` has a registry entry and a demo.** Adding
  or removing a component or a variant updates `meta.ts` in the same change.

## Choosing a component — in this order

1. An existing `ui` component with an existing variant (check its preview
   page before reaching for `className`).
2. An existing pattern.
3. Compose `ui` components inside the feature's `components/`.
4. Add a component from the project's chosen library (e.g.
   `npx shadcn@latest add <component>` in a shadcn project), wrap/adapt it
   in `components/ui` (tokens, RTL, field surface), register it with a demo.
5. Hand-write only what none of the above can express — still from tokens.

Never render a raw `<button>`, `<input>`, `<select>` or `<table>` for
something the library covers: the library version carries focus ring, field
surface, RTL fixes and dark-mode tokens.

## Changing a `ui` component

It changes **every screen** that uses it — look at its preview page before
and after. Form controls use the shared field surface; a control that is
itself a button (a Select trigger) also adds the focus style, because a mouse
click never gives a button `:focus-visible`.

## Tokens

Names vary by library; the structure does not.

- **Semantic** tokens (CSS variables or the library theme, light + dark):
  background, foreground, card/surface, primary, secondary, muted, accent,
  destructive, border, input, ring. Surfaces and text use them so dark mode
  works (in Tailwind: `bg-card`, `text-muted-foreground`, `border-border`).
- **Brand colours** defined once in the theme, each with a full tone and a
  tint for chips.
- No raw hex in components and no ad-hoc palette colours in new code;
  status chips use the badge component's variants.
- One radius token from which the whole radius scale derives.

## Copy, numbers, dates

- All user-facing text in the project language — labels, empty states,
  toasts, errors, `aria-label`, `sr-only`.
- Show the server's error (`result.error`) instead of writing a second
  message on the client.
- Format numbers with the locale (`toLocaleString('fa-IR')`); prices in the
  project's single money unit.
- Dates through one helper module (`@/lib/datetime`) in the project's
  calendar and timezone; never `Date.now()` during render — a `useNow()`
  hook whose server value means "unknown".

## RTL (Persian/Arabic projects)

- `<html lang="fa" dir="rtl">` once in the root layout.
- **Radix components take direction from their `dir` prop, not CSS** — set
  `dir="rtl"` on portal content and keyboard-navigable roots (dialog/sheet/
  popover content, tabs, sidebar); bake it into `ui` defaults where possible.
- Prefer logical utilities in new code: `ms-*`/`me-*`, `ps-*`/`pe-*`,
  `start-*`/`end-*`, `text-start`/`text-end`.
- Mirrored meaning: "next" points left; close buttons top-left; sheets from
  the right.
- LTR islands: wrap code, URLs, emails, phone numbers and file paths in
  `dir="ltr"`.
- Use the zero-width non-joiner where Persian needs it («می‌شود», «دوره‌ها»).
- Load the `rtl-design` skill for component-level RTL details.

## Conventions by need

| Need | Use |
|---|---|
| Buttons | `Button` variants and sizes |
| Dialogs, confirmations | one responsive dialog (dialog on desktop, drawer on mobile); destructive actions confirm first |
| Toasts | one toast system, mounted once in the root layout |
| Loading | `Spinner` in a disabled submitting button; `Skeleton`s for lists/cards (mirror the real layout so nothing shifts) |
| Forms | `Field` family + controls; per-field errors from `details` of a failed `ActionResult` |
| Tables | `Table` + `Pagination`; admin lists put a page header (search + primary action) above |
| Icons | one icon set (`lucide-react`) |
| Images | `next/image` |
| Motion | marketing/celebration moments only, not admin or forms |

## Dark mode

The `.dark` class switches semantic tokens. Built from tokens, a screen works
in both; hard-coded `bg-white`/`text-black` break it.

## Before finishing a UI change

- [ ] Built from `ui` components and patterns; nothing the library covers is hand-rolled
- [ ] Tokens only — no raw hex, no palette colours
- [ ] Copy in the project language; locale numbers and dates
- [ ] RTL checked (if applicable): `dir` on Radix content, icon direction, LTR islands
- [ ] Loading, empty and error states exist
- [ ] Destructive actions confirm
- [ ] New/changed `ui` component registered in `meta.ts` with a demo
- [ ] The user checks the result visually; diagnose layout bugs from the code
