'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Semantic UI modal: a white box over a dark dimmer, header with a rule
 * under it. Closes on Escape and on a click on the dimmer.
 *
 * `size`: `small` (the sign-in/sign-up dialogs) or `default`.
 */
export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  size?: 'small' | 'default';
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, size = 'small', children, className }: ModalProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    boxRef.current?.querySelector<HTMLElement>('input, button, a')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/85 px-[1em] py-[1em] md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir="rtl"
        className={cn(
          'animate-[modal-in_0.25s_ease-out] w-full rounded-ui bg-white px-[1em] pb-[1em] text-ui-text shadow-[1px_3px_3px_0_rgb(0_0_0/0.2),1px_3px_15px_2px_rgb(0_0_0/0.2)]',
          size === 'small' ? 'max-w-[720px]' : 'max-w-[900px]',
          className
        )}
      >
        <h2 id={titleId} className="border-b border-ui-border px-[0.5em] pb-[1em] pt-[1.5em] text-[1.21428571rem] font-bold">
          {title}
        </h2>
        <div className="pt-[0.5em]">{children}</div>
      </div>
    </div>,
    document.body
  );
}
