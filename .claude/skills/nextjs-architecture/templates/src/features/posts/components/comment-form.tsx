'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { addCommentAction } from '../actions';

/**
 * Calling a Server Action from a client component:
 *
 * - The action never throws; branch on `result.ok`.
 * - Show the server's message (`result.error`) — it is already in the user's
 *   language. Do not write a second message on the client.
 * - Field errors arrive in `result.details`.
 * - After a write whose data is read live, `router.refresh()` re-renders the
 *   server parts of the page.
 * - A submitting button is disabled and shows a spinner.
 */
export default function CommentForm({ postId }: { postId: number }) {
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await addCommentAction({ postId, body });
      if (!result.ok) {
        setFieldError(result.details?.body?.[0] ?? null);
        toast({ variant: 'destructive', title: result.error });
        return;
      }
      setBody('');
      setFieldError(null);
      toast({ title: 'نظر شما ثبت شد' });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="نظرتان را بنویسید…"
        aria-invalid={fieldError ? true : undefined}
      />
      {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
      <Button onClick={submit} disabled={pending || body.trim() === ''}>
        {pending && <Spinner />}
        ثبت نظر
      </Button>
    </div>
  );
}
