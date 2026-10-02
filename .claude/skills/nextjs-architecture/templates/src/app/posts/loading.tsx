import { Skeleton } from '@/components/ui/skeleton';

/** Suspense boundary for the `searchParams` read; mirrors the list layout. */
export default function Loading() {
  return (
    <main className="container space-y-6 py-10">
      <Skeleton className="h-9 w-40" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    </main>
  );
}
