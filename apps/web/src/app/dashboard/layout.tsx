'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="dashboard-layout">
        <div
          className="dashboard-main"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <h2>Moni</h2>
        <nav className="dashboard-nav">
          <Link
            href="/dashboard"
            data-active={pathname === '/dashboard' || undefined}
          >
            Overview
          </Link>
          <Link
            href="/dashboard/wallets"
            data-active={
              pathname.startsWith('/dashboard/wallets') || undefined
            }
          >
            Wallets
          </Link>
          <Link
            href="/dashboard/transactions"
            data-active={
              pathname.startsWith('/dashboard/transactions') ||
              undefined
            }
          >
            Transactions
          </Link>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1.5rem' }}>
          <p
            style={{
              fontSize: '0.85rem',
              color:
                'color-mix(in srgb, var(--foreground) 60%, transparent)',
              marginBottom: '0.5rem',
            }}
          >
            {user?.email}
          </p>
          <button
            onClick={signOut}
            className="btn btn-secondary btn-sm"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
