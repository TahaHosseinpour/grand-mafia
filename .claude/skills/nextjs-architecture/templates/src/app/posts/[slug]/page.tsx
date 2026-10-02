import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findPublishedPostBySlug, listPostComments } from '@/features/posts';
import { CommentForm } from '@/features/posts/client';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The full page pattern under `cacheComponents`:
 *
 *   static markup ............ always in the static shell
 *   'use cache' dal read ..... cached, shared by every visitor (the post)
 *   <Suspense> ............... fallback in the shell, content per request
 *                              (comments — they depend on the viewer)
 *
 * `generateMetadata` and the page call the same cached function, so the post
 * is queried once.
 */

export async function generateMetadata({ params }: PageProps<'/posts/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPublishedPostBySlug(slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt ?? undefined };
}

export default async function PostPage({ params }: PageProps<'/posts/[slug]'>) {
  const { slug } = await params;
  const post = await findPublishedPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="container space-y-8 py-10">
      <article className="space-y-4">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        <div className="whitespace-pre-line leading-8">{post.body}</div>
      </article>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">نظرات</h2>
        <CommentForm postId={post.id} />
        <Suspense fallback={<CommentsSkeleton />}>
          <Comments postId={post.id} />
        </Suspense>
      </section>
    </main>
  );
}

/** Live, per viewer — never cached, so it sits under Suspense. */
async function Comments({ postId }: { postId: number }) {
  const comments = await listPostComments(postId);
  if (comments.length === 0) return <p className="text-muted-foreground">هنوز نظری ثبت نشده است.</p>;

  return (
    <ul className="space-y-3">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg border border-border p-4">
          {comment.body}
        </li>
      ))}
    </ul>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
