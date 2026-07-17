'use client';

import { useState } from 'react';
import {
  useTransactions,
  useWallets,
  useCategories,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '@/lib/hooks';
import type { Transaction, CreateTransaction } from '@repo/types';
import {
  decimalToMinor,
  formatMinorAmount,
  minorToDecimal,
} from '@repo/types';

export default function TransactionsPage() {
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<CreateTransaction>({
    walletId: '',
    amountMinor: decimalToMinor(0),
    type: 'expense',
    description: '',
    transactionDate: new Date().toISOString().slice(0, 16),
  } as CreateTransaction);

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
  } = useTransactions({ limit: 100 });
  const { data: walletData, isLoading: walletLoading } = useWallets();
  const { data: categoryData } = useCategories();

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const transactions = txData?.transactions ?? [];
  const wallets = walletData?.wallets ?? [];
  const categories = categoryData?.categories ?? [];

  const walletsForSelect = wallets.map((w) => ({
    id: w.id,
    name: w.name,
  }));
  const categoriesForSelect = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  const isLoading = txLoading || walletLoading;
  const error =
    txError?.message ??
    createMutation.error?.message ??
    updateMutation.error?.message ??
    deleteMutation.error?.message ??
    '';

  const openCreate = () => {
    setForm({
      walletId: wallets[0]?.id ?? '',
      amountMinor: decimalToMinor(0),
      type: 'expense',
      description: '',
      transactionDate: new Date().toISOString().slice(0, 16),
    } as CreateTransaction);
    setEditing(null);
    setModal('create');
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      walletId: t.walletId,
      amountMinor: t.amountMinor,
      type: t.type,
      categoryId: t.categoryId,
      description: t.description ?? '',
      transactionDate: t.transactionDate.slice(0, 16),
    } as CreateTransaction);
    setModal('edit');
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  const formatAmount = (
    amountMinor: number,
    currency: string,
    type: string,
  ) => {
    const prefix = type === 'expense' ? '−' : '+';
    return `${prefix}${formatMinorAmount(amountMinor, currency)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const walletId = form.walletId || wallets[0]?.id;
    if (!walletId) return;
    const payload: CreateTransaction = {
      ...form,
      walletId,
      amountMinor: form.amountMinor,
      transactionDate: new Date(form.transactionDate!).toISOString(),
      categoryId: form.categoryId || null,
      description: form.description || null,
    };
    try {
      if (modal === 'create') {
        await createMutation.mutateAsync(payload);
      } else if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: {
            walletId: payload.walletId,
            amountMinor: payload.amountMinor,
            type: payload.type,
            categoryId: payload.categoryId,
            description: payload.description,
            transactionDate: payload.transactionDate,
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
    if (!confirm('Delete this transaction?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // Error surfaced via mutation.error
    }
  };

  const expenseCategories = categoriesForSelect.filter(
    (c) => c.type === 'expense',
  );
  const incomeCategories = categoriesForSelect.filter(
    (c) => c.type === 'income',
  );

  if (isLoading) return <p>Loading transactions...</p>;
  if (error) return <p className="auth-error">Error: {error}</p>;

  return (
    <>
      <div className="dashboard-header">
        <h1>Transactions</h1>
        <button
          onClick={openCreate}
          className="btn btn-primary"
          disabled={wallets.length === 0}
        >
          Add transaction
        </button>
      </div>

      {wallets.length === 0 && (
        <p
          className="auth-error"
          style={{ marginBottom: '1rem' }}
        >
          Create a wallet first before adding transactions.
        </p>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.transactionDate)}</td>
                  <td>{t.description || t.merchant || '—'}</td>
                  <td>{t.type}</td>
                  <td
                    className={
                      t.type === 'expense' ? 'negative' : 'positive'
                    }
                  >
                    {formatAmount(t.amountMinor, t.currency, t.type)}
                  </td>
                  <td>
                    <button
                      onClick={() => openEdit(t)}
                      className="btn btn-secondary btn-sm"
                      style={{ marginRight: '0.5rem' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length === 0 && (
          <p
            style={{
              color:
                'color-mix(in srgb, var(--foreground) 60%, transparent)',
              margin: 0,
            }}
          >
            No transactions yet.
          </p>
        )}
      </div>

      {modal && (
        <div
          className="modal-overlay"
          onClick={() => setModal(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {modal === 'create'
                ? 'Add transaction'
                : 'Edit transaction'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Wallet</label>
                <select
                  value={form.walletId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      walletId: e.target.value,
                    }))
                  }
                  required
                >
                  {walletsForSelect.map((w) => (
                    <option
                      key={w.id}
                      value={w.id}
                    >
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target
                        .value as CreateTransaction['type'],
                    }))
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="form-row">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minorToDecimal(form.amountMinor)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      amountMinor: decimalToMinor(
                        e.target.value || '0',
                      ),
                    }))
                  }
                  required
                />
              </div>
              <div className="form-row">
                <label>Category</label>
                <select
                  value={form.categoryId ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categoryId: e.target.value || null,
                    }))
                  }
                >
                  <option value="">—</option>
                  {(form.type === 'expense'
                    ? expenseCategories
                    : incomeCategories
                  ).map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Description</label>
                <input
                  value={form.description ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="form-row">
                <label>Date</label>
                <input
                  type="datetime-local"
                  value={form.transactionDate ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      transactionDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
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
