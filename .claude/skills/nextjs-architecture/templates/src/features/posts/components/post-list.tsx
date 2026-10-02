import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { routes } from '@/server/routes';
import type { Paged } from '@/server/types';
import type { PostListItemDTO } from '../types';

/**
 * Props are typed with the DTO — never a hand-written parallel interface.
 * Built from `@/components/ui`, semantic tokens only, logical spacing.
 *
 * No `'use client'`: it has no state, so it renders on the server and ships
 * no JS. Add the directive only when a component needs state or effects.
 */
export default function PostList({ posts }: { posts: Paged<PostListItemDTO> }) {
  if (posts.items.length === 0) {
    return <p className="text-muted-foreground">هنوز مطلبی منتشر نشده است.</p>;
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {posts.items.map((post) => (
        <li key={post.id}>
          <Link href={routes.post(post.slug)}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{post.title}</CardTitle>
              </CardHeader>
              {post.excerpt && (
                <CardContent className="text-muted-foreground">{post.excerpt}</CardContent>
              )}
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
