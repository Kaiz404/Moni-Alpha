'use client';

import { useEffect, useState } from 'react';
import { clockTime } from '@/lib/ledger/format';

/** "Back by 3:30 pm your time." in the visitor's zone, read after hydration; "Back soon." with no time. */
export function BackBy({ until }: { until: string }) {
  const [text, setText] = useState('Back soon.');
  useEffect(() => {
    if (until && !Number.isNaN(Date.parse(until))) setText(`Back by ${clockTime(until, Intl.DateTimeFormat().resolvedOptions().timeZone)} your time.`);
  }, [until]);
  return <>{text}</>;
}
