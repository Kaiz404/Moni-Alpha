'use client';

import { useState } from 'react';
import {
  useWallets,
  useCreateWallet,
  useUpdateWallet,
  useDeleteWallet,
} from '@/lib/hooks';
import type { Wallet, CreateWallet } from '@repo/types';

const WALLET_TYPES = ['bank', 'cash', 'credit', 'debit', 'ewallet', 'investment', 'other'] as const;
const WALLET_ICONS: Record<string, string> = {
  bank: '🏦',
  cash: '💵',
  credit: '💳',
  debit: '💳',
  ewallet: '📱',
  investment: '📈',
  other: '💰',
};

export default function WalletsPage() {
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [form, setForm] = useState<CreateWallet>({
    name: '',
    type: 'bank',
    currency: 'USD',
    initialBalance: 0,
    color: '#2563eb',
    icon: '🏦',
  });

  const { data: walletData, isLoading, error } = useWallets();
  const createMutation = useCreateWallet();
  const updateMutation = useUpdateWallet();
  const deleteMutation = useDeleteWallet();

  const wallets = walletData?.wallets ?? [];
  const displayError = error?.message ?? createMutation.error?.message ?? updateMutation.error?.message ?? deleteMutation.error?.message ?? '';

  const openCreate = () => {
    setForm({
      name: '',
      type: 'bank',
      currency: 'USD',
      initialBalance: 0,
      color: '#2563eb',
      icon: '🏦',
    });
    setEditing(null);
    setModal('create');
  };

  const openEdit = (w: Wallet) => {
    setEditing(w);
    setForm({
      name: w.name,
      type: w.type,
      currency: 'USD',
      initialBalance: w.initialBalance,
      color: w.color,
      icon: w.icon,
    });
    setModal('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal === 'create') {
        await createMutation.mutateAsync(form);
      } else if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: {
            name: form.name,
            type: form.type,
            color: form.color,
            icon: form.icon,
          },
        });
      }
      setModal(null);
      setEditing(null);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this wallet? It will be deactivated.')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  if (isLoading) return <p>Loading wallets...</p>;
  if (displayError) return <p className="auth-error">Error: {displayError}</p>;

  return (
    <>
      <div className="dashboard-header">
        <h1>Wallets</h1>
        <button onClick={openCreate} className="btn btn-primary">
          Add wallet
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Balance</th>
                <th>Currency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.id}>
                  <td>
                    <span style={{ marginRight: '0.5rem' }}>{w.icon}</span>
                    {w.name}
                  </td>
                  <td>{w.type}</td>
                  <td>
                    ${(w.currentBalance ?? w.initialBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td>{w.currency}</td>
                  <td>
                    <button onClick={() => openEdit(w)} className="btn btn-secondary btn-sm" style={{ marginRight: '0.5rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="btn btn-danger btn-sm">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {wallets.length === 0 && (
          <p style={{ color: 'color-mix(in srgb, var(--foreground) 60%, transparent)', margin: 0 }}>
            No wallets yet. Create one to get started.
          </p>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'create' ? 'Add wallet' : 'Edit wallet'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Main Bank"
                />
              </div>
              <div className="form-row">
                <label>Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as CreateWallet['type'],
                      icon: WALLET_ICONS[e.target.value] || '💰',
                    }))
                  }
                >
                  {WALLET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {modal === 'create' && (
                <div className="form-row">
                  <label>Initial balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.initialBalance}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialBalance: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
              )}
              <div className="form-row">
                <label>Color</label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  style={{ width: '60px', height: '36px', padding: 2 }}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {modal === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
