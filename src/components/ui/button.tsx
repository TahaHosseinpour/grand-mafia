import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * The button. Chunky and tactile: a solid face over a darker base that it
 * presses into (`active:translate-y`), in the display face from `md` up.
 *
 * variant: `primary` (the orange call to action), `secondary`, `ghost`,
 * `danger`, `lib` / `fas` (team-coloured).
 */
const VARIANTS = {
  primary: 'bg-accent text-white shadow-[0_4px_0_var(--color-accent-deep)] hover:bg-accent-strong',
  secondary: 'bg-surface-3 text-fg shadow-[0_4px_0_#151311] hover:bg-[#3a3531]',
  ghost: 'bg-transparent text-fg-muted shadow-none hover:bg-surface-3 hover:text-fg active:translate-y-0',
  danger: 'bg-danger text-white shadow-[0_4px_0_#7d1d1d] hover:bg-[#e24b4b]',
  lib: 'bg-lib text-white shadow-[0_4px_0_var(--color-lib-deep)] hover:bg-[#4795b6]',
  fas: 'bg-fas text-white shadow-[0_4px_0_var(--color-fas-deep)] hover:bg-[#d44f35]',
} as const;

const SIZES = {
  sm: 'h-9 rounded-lg px-3 text-[0.9375rem] font-bold',
  md: 'h-11 rounded-xl px-5 font-display text-[1.25rem]',
  lg: 'h-14 rounded-2xl px-8 font-display text-[1.6rem]',
} as const;

/** Names the first version of the site used; kept so older call sites read the same. */
const VARIANT_ALIASES = { default: 'secondary', lobby: 'primary', liberal: 'lib', negative: 'danger' } as const;
const SIZE_ALIASES = { small: 'sm', default: 'md', large: 'lg' } as const;

type Variant = keyof typeof VARIANTS | keyof typeof VARIANT_ALIASES;
type Size = keyof typeof SIZES | keyof typeof SIZE_ALIASES;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Full width. */
  fluid?: boolean;
};

const resolveVariant = (variant: Variant) => (variant in VARIANT_ALIASES ? VARIANT_ALIASES[variant as keyof typeof VARIANT_ALIASES] : (variant as keyof typeof VARIANTS));
const resolveSize = (size: Size) => (size in SIZE_ALIASES ? SIZE_ALIASES[size as keyof typeof SIZE_ALIASES] : (size as keyof typeof SIZES));

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  fluid = false,
  className,
}: Pick<ButtonProps, 'variant' | 'size' | 'fluid' | 'className'>) {
  return cn(
    'inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap leading-none no-underline transition-[transform,background-color,box-shadow] duration-100',
    'active:translate-y-[3px] active:shadow-none',
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    VARIANTS[resolveVariant(variant)],
    SIZES[resolveSize(size)],
    fluid && 'flex w-full',
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fluid, className, type = 'button', ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, fluid, className })} {...props} />;
});
