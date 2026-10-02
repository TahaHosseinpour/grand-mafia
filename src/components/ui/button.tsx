import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Semantic UI button the legacy app used everywhere, rebuilt on tokens.
 *
 * variant: `default` (grey), `primary` (blue), `lobby` (the orange "Game
 * Lobby" button), `liberal` (the blue sign-in pair), `negative`.
 */
const VARIANTS = {
  default: 'bg-ui-grey text-ui-text-muted hover:bg-ui-grey-hover hover:text-ui-text',
  primary: 'bg-ui-primary text-white hover:bg-ui-primary-hover',
  lobby: 'bg-fascist text-white hover:bg-fascist',
  liberal: 'bg-liberal text-white hover:bg-liberal',
  negative: 'bg-[#db2828] text-white hover:bg-[#d01919]',
} as const;

const SIZES = {
  small: 'text-[0.92857143rem]',
  default: 'text-base',
  large: 'text-[1.28571429rem]',
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Full width. */
  fluid?: boolean;
};

export function buttonClasses({
  variant = 'default',
  size = 'default',
  fluid = false,
  className,
}: Pick<ButtonProps, 'variant' | 'size' | 'fluid' | 'className'>) {
  return cn(
    'inline-block min-h-[1em] cursor-pointer select-none rounded-ui px-[1.5em] py-[0.78571429em] text-center font-bold leading-none no-underline transition-colors duration-100',
    'disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary',
    VARIANTS[variant],
    SIZES[size],
    fluid && 'block w-full',
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fluid, className, type = 'button', ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, fluid, className })} {...props} />;
});
