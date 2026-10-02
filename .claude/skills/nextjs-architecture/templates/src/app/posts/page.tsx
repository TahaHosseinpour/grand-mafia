import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listPostsQuery, listPublishedPosts } from '@/features/posts';
import { PostList } from '@/features/posts/client';
import { routes } from '@/server/routes';

export const metadata: Metadata = { title: 'مطالب' };

/**
 * A page is a shell: resolve params, call the dal through the barrel, render
 * a feature component. No queries, no business logic, no access checks here.
 *
 * `searchParams` is request data, read here — outside the cached dal
 * function, which receives the parsed query as an argument (part of its
 * cache key). The sibling `loading.tsx` is the Suspense boundary that reading
 * request data needs under `cacheComponents`.
 */
export default async function PostsPage({ searchParams }: PageProps<'/posts'>) {
  const { page, search } = await searchParams;
  // safeParse: a junk query string falls back to the defaults instead of a 500.
  const parsed = listPostsQuery.safeParse({ page, search });
  const query = parsed.success ? parsed.data : listPostsQuery.parse({});
  const posts = await listPublishedPosts(query);

  // A page past the end: back to the first page instead of a false empty state.
  if (query.page > 1 && posts.items.length === 0) redirect(routes.posts);

  return (
    <main className="container space-y-6 py-10">
      <h1 className="text-3xl font-bold">مطالب</h1>
      <PostList posts={posts} />
    </main>
  );
}
