'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/datetime';

/** «N بازیکن آنلاین» on the home page. */
export default function OnlineCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/online-playercount')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { count?: number } | null) => {
        if (!cancelled && typeof data?.count === 'number') setCount(data.count);
      })
      .catch(() => {
        // The badge simply stays without a number.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[0.9rem] text-fg-muted ring-1 ring-white/10">
      <span className="size-2 rounded-full bg-ok shadow-[0_0_8px_var(--color-ok)]" />
      {count !== null ? `${formatNumber(count)} بازیکن آنلاین` : 'بازیکنان آنلاین'}
    </span>
  );
}
