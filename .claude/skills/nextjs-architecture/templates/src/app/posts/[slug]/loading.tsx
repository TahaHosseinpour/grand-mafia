import { Skeleton } from '@/components/ui/skeleton';

/**
 * The Suspense boundary for this segment. Awaiting `params` in the page is a
 * request-time read under `cacheComponents`; without a boundary (this file,
 * a `<Suspense>`, or `generateStaticParams`) `next build` fails.
 *
 * Mirror the real page's layout so nothing shifts when content arrives.
 */
export default function Loading() {
  return (
    <main className="container space-y-4 py-10">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </main>
  );
}
