import type { Metadata } from 'next';
import Link from 'next/link';
import { Cat, Wordmark } from '@/components/brand';
import '@/components/account/account.css';

export const metadata: Metadata = {
  title: 'Your account is deleted · Moni',
};

/** W2-Parts "Done": outside the app, because the account and every session are gone. */
export default function DeletedPage() {
  return (
    <main className="deleted">
      <span className="wordmark">
        <Wordmark size={32} />
      </span>
      <Cat size={72} id="deleted-cat" />
      <h1 className="site-title deleted-title">Your account is deleted</h1>
      <p className="site-lede">
        Everything Moni kept for you is gone from this browser and your phone. Thank you for trying Moni.
      </p>
      <Link href="/" className="btn btn-ink press">
        Back to the Moni website
      </Link>
    </main>
  );
}
