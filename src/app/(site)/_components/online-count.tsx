'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { formatNumber } from '@/lib/datetime';

/** "N players online now" badge on the home banner. */
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
    <div className="absolute end-[20px] top-[10px] flex items-center gap-1 bg-[#ad76cc] p-[5px] text-[18px] text-[#ddd]">
      <User aria-hidden className="size-[18px] fill-[lightblue] text-[lightblue]" />
      {count !== null ? <span className="text-online">{formatNumber(count)}</span> : null}
      <span>بازیکن آنلاین</span>
    </div>
  );
}
