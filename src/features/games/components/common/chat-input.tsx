'use client';

import { SendHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import EmotePicker from './emote-picker';

/**
 * The message box of both chats: Enter sends, Shift+Enter is a new line,
 * 300 characters at most (the server's limit).
 */
export default function ChatInput({
  onSend,
  placeholder = 'پیام…',
  disabled,
  disabledText,
  className,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledText?: string;
  className?: string;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const trimmed = text.trim();

  const send = () => {
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    box.current?.focus();
  };

  if (disabled) {
    return <div className={cn('rounded-xl bg-surface-2 px-4 py-3 text-center text-[0.9rem] text-fg-faint', className)}>{disabledText}</div>;
  }

  return (
    <form
      className={cn('flex items-end gap-1.5', className)}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <EmotePicker onPick={(code) => setText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${code} `)} />
      <textarea
        ref={box}
        rows={1}
        dir="auto"
        maxLength={300}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-fg outline-none placeholder:text-fg-faint focus:border-accent"
      />
      <button
        type="submit"
        aria-label="ارسال"
        disabled={!trimmed}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-white shadow-[0_3px_0_var(--color-accent-deep)] transition active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:shadow-none"
      >
        <SendHorizontal className="size-5 -scale-x-100" />
      </button>
    </form>
  );
}
