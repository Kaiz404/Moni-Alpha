import type { Metadata } from 'next';
import Link from 'next/link';
import { Glyph } from '@/components/ledger/glyph';
import { BackBy } from '@/components/states/back-by';
import { FullPage, StatusLink } from '@/components/states/full-page';

export const metadata: Metadata = { title: 'Moni is having an update' };
export const dynamic = 'force-dynamic';

/**
 * W2-States maintenance: sleepy, because Moni is away for a while. The proxy sends every page here while
 * `MONI_MAINTENANCE_UNTIL` is set; the time it names shows in the visitor's own zone.
 */
export default function MaintenancePage() {
  const until = process.env.MONI_MAINTENANCE_UNTIL ?? '';
  return (
    <FullPage
      mood="sleepy"
      title="Moni is having an update"
      line={
        <>
          <BackBy until={until} /> Your phone keeps catching spends meanwhile, and they sync once the update is done.
        </>
      }
    >
      <StatusLink label="Check Moni status" className="btn btn-sand press" />
      <Link href="/" className="btn btn-out press">
        <Glyph name="refresh" size={20} />
        Try again
      </Link>
    </FullPage>
  );
}
