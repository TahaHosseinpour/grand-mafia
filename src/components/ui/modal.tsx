'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * A dialog: a bottom sheet on phones, a centred card from `sm` up. Closes on
 * Escape, on the dimmer and on the ✕ — unless `dismissible` is false (the
 * terms of use, a vote the player must cast).
 */
export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: 'small' | 'default' | 'wide';
  dismissible?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Extra classes for the title (e.g. a team colour). */
  titleClassName?: string;
};

export function Modal({ open, onClose, title, size = 'small', dismissible = true, children, className, titleClassName }: ModalProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    boxRef.current?.querySelector<HTMLElement>('input, textarea, [data-autofocus]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        dir="rtl"
        className={cn(
          'relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-fg shadow-[0_-8px_40px_rgb(0_0_0/0.5)]',
          'animate-[sheet-in_0.22s_ease-out] sm:animate-[pop-in_0.18s_ease-out] sm:rounded-3xl sm:pb-6',
          size === 'small' && 'sm:max-w-[440px]',
          size === 'default' && 'sm:max-w-[560px]',
          size === 'wide' && 'sm:max-w-[760px]',
          className
        )}
      >
        <span aria-hidden className="mx-auto -mt-2 mb-3 block h-1.5 w-12 rounded-full bg-line sm:hidden" />
        {dismissible ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="absolute end-3 top-3 flex size-9 cursor-pointer items-center justify-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <X className="size-5" />
          </button>
        ) : null}
        {title ? (
          <h2 id={titleId} className={cn('mb-4 pe-10 font-display text-[1.75rem] leading-tight text-fg', titleClassName)}>
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
