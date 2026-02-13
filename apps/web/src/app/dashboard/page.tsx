'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { OverviewStatsResponse } from '@repo/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<OverviewStatsResponse>('/api/analytics/overview')
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading overview...</p>;
  if (error) return <p className="auth-error">Error: {error}</p>;
  if (!stats) return null;

  const { totalIncome, totalExpenses, netCashFlow, totalBalance, transactionCount } =
    stats.stats;

  return (
    <>
      <div className="dashboard-header">
        <h1>Overview</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Total Balance</div>
          <div className="value">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card">
          <div className="label">Income (this month)</div>
          <div className="value positive">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card">
          <div className="label">Expenses (this month)</div>
          <div className="value negative">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card">
          <div className="label">Net Cash Flow</div>
          <div className={`value ${netCashFlow >= 0 ? 'positive' : 'negative'}`}>
            ${netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Transactions</div>
          <div className="value">{transactionCount}</div>
        </div>
      </div>

      <div className="card">
        <h3>Quick start</h3>
        <p style={{ margin: 0, color: 'color-mix(in srgb, var(--foreground) 70%, transparent)' }}>
          Create a wallet to start tracking your finances. Then add transactions to see your spending and income.
        </p>
      </div>
    </>
  );
}
