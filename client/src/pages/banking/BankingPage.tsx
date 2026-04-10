import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, X, Check, Upload, Link, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  bankApi,
  type BankAccount,
  type BankTransaction,
  type Reconciliation,
  type TransactionRow,
} from '@/services/bankingService';

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BankingPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ['bankAccounts'],
    queryFn: () => bankApi.getAll().then((r) => r.data.data.bankAccounts),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => bankApi.remove(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['bankAccounts'] });
      if (selectedId === id) setSelectedId(null);
    },
    onError: (e: any) => setPageError(e.response?.data?.error || 'Failed to deactivate account.'),
  });

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Banking</h1>

      {pageError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex justify-between">
          <span>{pageError}</span>
          <button onClick={() => setPageError(null)}>✕</button>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* ── Left Sidebar: Accounts ── */}
        <div className="w-72 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bank Accounts
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setShowAddAccount((v) => !v);
                setEditAccountId(null);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {showAddAccount && (
            <AddAccountForm
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ['bankAccounts'] });
                setShowAddAccount(false);
              }}
              onCancel={() => setShowAddAccount(false)}
            />
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : accounts.length === 0 && !showAddAccount ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No bank accounts yet.
            </div>
          ) : (
            accounts.map((account) =>
              editAccountId === account.id ? (
                <EditAccountForm
                  key={account.id}
                  account={account}
                  onSuccess={() => {
                    qc.invalidateQueries({ queryKey: ['bankAccounts'] });
                    setEditAccountId(null);
                  }}
                  onCancel={() => setEditAccountId(null)}
                />
              ) : (
                <AccountCard
                  key={account.id}
                  account={account}
                  selected={selectedId === account.id}
                  onClick={() => setSelectedId(account.id)}
                  onEdit={() => {
                    setEditAccountId(account.id);
                    setShowAddAccount(false);
                  }}
                  onDeactivate={() => {
                    if (confirm(`Deactivate "${account.name}"?`))
                      deactivateMutation.mutate(account.id);
                  }}
                />
              ),
            )
          )}
        </div>

        {/* ── Right Panel: Account Detail ── */}
        {selectedAccount ? (
          <div className="flex-1 min-w-0">
            <AccountDetail account={selectedAccount} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed h-64 text-muted-foreground text-sm">
            Select a bank account to view transactions
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({
  account,
  selected,
  onClick,
  onEdit,
  onDeactivate,
}: {
  account: BankAccount;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const bal = parseFloat(account.currentBalance);
  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{account.name}</p>
          {account.bankName && (
            <p className="text-xs text-muted-foreground truncate">{account.bankName}</p>
          )}
          {account.accountNumber && (
            <p className="text-xs text-muted-foreground">••••{account.accountNumber.slice(-4)}</p>
          )}
        </div>
        <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="text-muted-foreground hover:text-destructive p-0.5 rounded"
            onClick={onDeactivate}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p
        className={`text-sm font-mono mt-1 font-semibold ${
          bal >= 0 ? 'text-green-700' : 'text-red-600'
        }`}
      >
        ${bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
      {!account.isActive && (
        <span className="text-xs text-muted-foreground italic">Inactive</span>
      )}
    </div>
  );
}

// ─── Add Account Form ──────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  openingBalance: z.string().optional(),
});
type AccountFormData = z.infer<typeof accountSchema>;

function AddAccountForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({ resolver: zodResolver(accountSchema) });

  const onSubmit = async (data: AccountFormData) => {
    try {
      await bankApi.create(data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create account.');
    }
  };

  return (
    <Card className="text-sm">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm">New Bank Account</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          {error && (
            <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input className="h-7 text-xs" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bank Name</Label>
            <Input className="h-7 text-xs" {...register('bankName')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Account Number</Label>
            <Input className="h-7 text-xs" {...register('accountNumber')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Opening Balance</Label>
            <Input className="h-7 text-xs" placeholder="0.00" {...register('openingBalance')} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Add'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Edit Account Form ─────────────────────────────────────────────────────────

function EditAccountForm({
  account,
  onSuccess,
  onCancel,
}: {
  account: BankAccount;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account.name,
      bankName: account.bankName ?? '',
      accountNumber: account.accountNumber ?? '',
      routingNumber: account.routingNumber ?? '',
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    try {
      await bankApi.update(account.id, data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update account.');
    }
  };

  return (
    <Card className="text-sm border-primary/40">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm">Edit Account</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          {error && (
            <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input className="h-7 text-xs" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bank Name</Label>
            <Input className="h-7 text-xs" {...register('bankName')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Account Number</Label>
            <Input className="h-7 text-xs" {...register('accountNumber')} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={isSubmitting}>
              <Check className="h-3 w-3 mr-1" />
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onCancel}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Account Detail (tabs: Transactions | Reconcile) ──────────────────────────

function AccountDetail({ account }: { account: BankAccount }) {
  const [tab, setTab] = useState<'transactions' | 'reconcile'>('transactions');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{account.name}</h2>
          {account.bankName && (
            <p className="text-sm text-muted-foreground">{account.bankName}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p
            className={`text-xl font-mono font-bold ${
              parseFloat(account.currentBalance) >= 0 ? 'text-green-700' : 'text-red-600'
            }`}
          >
            ${parseFloat(account.currentBalance).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-4">
        {(['transactions', 'reconcile'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'reconcile' ? 'Reconciliation' : 'Transactions'}
          </button>
        ))}
      </div>

      {tab === 'transactions' ? (
        <TransactionsPanel account={account} />
      ) : (
        <ReconcilePanel account={account} />
      )}
    </div>
  );
}

// ─── Transactions Panel ────────────────────────────────────────────────────────

function TransactionsPanel({ account }: { account: BankAccount }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'unreconciled'>('all');
  const [showAddTx, setShowAddTx] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [matchingTxId, setMatchingTxId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const txKey = ['transactions', account.id, page, filter];
  const { data, isLoading } = useQuery<{
    transactions: BankTransaction[];
    total: number;
    pages: number;
  }>({
    queryKey: txKey,
    queryFn: () =>
      bankApi.getTransactions(account.id, page, filter).then((r) => r.data.data),
  });

  const unmatchMutation = useMutation({
    mutationFn: (txId: number) => bankApi.unmatchTx(account.id, txId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', account.id] }),
    onError: (e: any) => setError(e.response?.data?.error || 'Unmatch failed.'),
  });

  // Reset page when filter changes
  const handleFilterChange = (f: typeof filter) => {
    setFilter(f);
    setPage(1);
  };

  const transactions = data?.transactions ?? [];
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded bg-destructive/10 p-2 text-sm text-destructive flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['all', 'unmatched', 'unreconciled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowImport(true)}
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setShowAddTx((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" /> Add Transaction
          </Button>
        </div>
      </div>

      {showAddTx && (
        <AddTransactionForm
          bankAccountId={account.id}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['transactions', account.id] });
            qc.invalidateQueries({ queryKey: ['bankAccounts'] });
            setShowAddTx(false);
          }}
          onCancel={() => setShowAddTx(false)}
        />
      )}

      {/* Match JE form */}
      {matchingTxId !== null && (
        <MatchJEForm
          bankAccountId={account.id}
          txId={matchingTxId}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['transactions', account.id] });
            setMatchingTxId(null);
          }}
          onCancel={() => setMatchingTxId(null)}
        />
      )}

      {/* Transactions table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No transactions found.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-center font-medium">Type</th>
                <th className="px-3 py-2 text-center font-medium">Status</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{tx.date}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{tx.description}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span
                      className={
                        tx.type === 'credit' ? 'text-green-700 font-medium' : 'text-red-600'
                      }
                    >
                      {tx.type === 'credit' ? '+' : '-'}$
                      {parseFloat(tx.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        tx.type === 'credit'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-col gap-0.5 items-center">
                      {tx.reconciled && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          reconciled
                        </span>
                      )}
                      {tx.matchedJournalEntryId && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                          JE #{tx.matchedJournalEntryId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {tx.matchedJournalEntryId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Unmatch journal entry"
                          onClick={() => unmatchMutation.mutate(tx.id)}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Match to journal entry"
                          onClick={() => setMatchingTxId(tx.id)}
                        >
                          <Link className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          bankAccountId={account.id}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['transactions', account.id] });
            qc.invalidateQueries({ queryKey: ['bankAccounts'] });
            setShowImport(false);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

// ─── Add Transaction Form ──────────────────────────────────────────────────────

const txSchema = z.object({
  date: z.string().min(1, 'Date required'),
  description: z.string().min(1, 'Description required'),
  amount: z.string().min(1, 'Amount required'),
  type: z.enum(['debit', 'credit']),
});
type TxFormData = z.infer<typeof txSchema>;

function AddTransactionForm({
  bankAccountId,
  onSuccess,
  onCancel,
}: {
  bankAccountId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TxFormData>({
    resolver: zodResolver(txSchema),
    defaultValues: { type: 'debit', date: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (data: TxFormData) => {
    try {
      await bankApi.addTransaction(bankAccountId, data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to add transaction.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && (
            <div className="rounded bg-destructive/10 p-2 text-sm text-destructive">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Type *</Label>
              <select
                {...register('type')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="debit">Debit (Money Out)</option>
                <option value="credit">Credit (Money In)</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description *</Label>
              <Input {...register('description')} />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" min="0" {...register('amount')} />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Add Transaction'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Match JE Form ─────────────────────────────────────────────────────────────

function MatchJEForm({
  bankAccountId,
  txId,
  onSuccess,
  onCancel,
}: {
  bankAccountId: number;
  txId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [jeId, setJeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(jeId);
    if (!id) return setError('Enter a valid Journal Entry ID.');
    setSaving(true);
    try {
      await bankApi.matchTx(bankAccountId, txId, id);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Match failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 flex items-end gap-3 flex-wrap">
      <div className="space-y-1">
        <Label className="text-xs">Match Transaction #{txId} to Journal Entry ID</Label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Input
          className="h-8 w-32 text-sm"
          type="number"
          placeholder="JE ID"
          value={jeId}
          onChange={(e) => setJeId(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          <Link className="h-3.5 w-3.5 mr-1" />
          {saving ? 'Matching…' : 'Match'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── CSV Import Modal ──────────────────────────────────────────────────────────

function ImportModal({
  bankAccountId,
  onSuccess,
  onClose,
}: {
  bankAccountId: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<TransactionRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string) => {
    setParseError(null);
    const lines = text.trim().split('\n').filter(Boolean);
    // Skip header row if it starts with "date" (case-insensitive)
    const dataLines =
      lines[0]?.toLowerCase().startsWith('date') ? lines.slice(1) : lines;

    const rows: TransactionRow[] = [];
    for (const line of dataLines) {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 4) {
        setParseError(`Invalid row (expected date,description,amount,type): ${line}`);
        return;
      }
      const [date, description, amount, typeRaw] = parts;
      const type = typeRaw.toLowerCase();
      if (type !== 'debit' && type !== 'credit') {
        setParseError(`Invalid type "${typeRaw}" — must be "debit" or "credit".`);
        return;
      }
      if (!date || !description || isNaN(parseFloat(amount))) {
        setParseError(`Invalid row: ${line}`);
        return;
      }
      rows.push({ date, description, amount, type });
    }
    setPreview(rows);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    setImportError(null);
    try {
      await bankApi.importTransactions(bankAccountId, preview);
      onSuccess();
    } catch (e: any) {
      setImportError(e.response?.data?.error || 'Import failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 mx-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import Transactions (CSV)</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground font-mono">
          Expected format: date,description,amount,type
          <br />
          Example: 2024-01-15,Rent payment,1500.00,debit
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2024-01-20,Client payment,5000.00,credit
        </div>

        <div className="space-y-2">
          <Label>Select CSV File</Label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
        </div>

        {parseError && (
          <div className="rounded bg-destructive/10 p-2 text-sm text-destructive">{parseError}</div>
        )}

        {preview.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{preview.length} row(s) parsed</p>
            <div className="max-h-48 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-right">Amount</th>
                    <th className="px-2 py-1.5 text-center">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1">{row.date}</td>
                      <td className="px-2 py-1 max-w-xs truncate">{row.description}</td>
                      <td className="px-2 py-1 text-right font-mono">{row.amount}</td>
                      <td className="px-2 py-1 text-center">
                        <span
                          className={`text-xs px-1 py-0.5 rounded ${
                            row.type === 'credit'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importError && (
          <div className="rounded bg-destructive/10 p-2 text-sm text-destructive">{importError}</div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={preview.length === 0 || saving}>
            <Upload className="h-4 w-4 mr-2" />
            {saving ? 'Importing…' : `Import ${preview.length} Transaction${preview.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Reconcile Panel ───────────────────────────────────────────────────────────

function ReconcilePanel({ account }: { account: BankAccount }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const openKey = ['reconOpen', account.id];
  const historyKey = ['reconHistory', account.id];

  const { data: openData, isLoading: loadingOpen } = useQuery<{
    reconciliation: Reconciliation | null;
    transactions: BankTransaction[];
  }>({
    queryKey: openKey,
    queryFn: () => bankApi.getOpenRecon(account.id).then((r) => r.data.data),
  });

  const { data: history = [] } = useQuery<Reconciliation[]>({
    queryKey: historyKey,
    queryFn: () =>
      bankApi.getReconciliations(account.id).then((r) => r.data.data.reconciliations),
  });

  const startMutation = useMutation({
    mutationFn: (data: { statementDate: string; statementBalance: string }) =>
      bankApi.startRecon(account.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openKey });
      qc.invalidateQueries({ queryKey: historyKey });
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to start reconciliation.'),
  });

  const closeMutation = useMutation({
    mutationFn: ({
      reconId,
      markedTxIds,
    }: {
      reconId: number;
      markedTxIds: number[];
    }) => bankApi.closeRecon(account.id, reconId, markedTxIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openKey });
      qc.invalidateQueries({ queryKey: historyKey });
      qc.invalidateQueries({ queryKey: ['bankAccounts'] });
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to close reconciliation.'),
  });

  if (loadingOpen) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded bg-destructive/10 p-2 text-sm text-destructive flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {openData?.reconciliation ? (
        <ReconcileWorkspace
          recon={openData.reconciliation}
          transactions={openData.transactions}
          onClose={(reconId, markedTxIds) =>
            closeMutation.mutate({ reconId, markedTxIds })
          }
          closing={closeMutation.isPending}
        />
      ) : (
        <StartReconForm
          onStart={(data) => startMutation.mutate(data)}
          starting={startMutation.isPending}
        />
      )}

      {/* History */}
      {history.filter((r) => r.status === 'closed').length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Reconciliation History
          </h3>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Statement Date</th>
                  <th className="px-4 py-2 text-right font-medium">Statement Balance</th>
                  <th className="px-4 py-2 text-right font-medium">Reconciled Balance</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history
                  .filter((r) => r.status === 'closed')
                  .map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{r.statementDate}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        ${parseFloat(r.statementBalance).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        ${parseFloat(r.reconciledBalance).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                          closed
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Start Reconciliation Form ─────────────────────────────────────────────────

const reconSchema = z.object({
  statementDate: z.string().min(1, 'Statement date required'),
  statementBalance: z.string().min(1, 'Statement balance required'),
});
type ReconFormData = z.infer<typeof reconSchema>;

function StartReconForm({
  onStart,
  starting,
}: {
  onStart: (data: ReconFormData) => void;
  starting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReconFormData>({ resolver: zodResolver(reconSchema) });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Start Bank Reconciliation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onStart)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the statement date and ending balance from your bank statement. Then check off
            the transactions that appear on the statement.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statement Date *</Label>
              <Input type="date" {...register('statementDate')} />
              {errors.statementDate && (
                <p className="text-xs text-destructive">{errors.statementDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Statement Ending Balance *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('statementBalance')} />
              {errors.statementBalance && (
                <p className="text-xs text-destructive">{errors.statementBalance.message}</p>
              )}
            </div>
          </div>
          <Button type="submit" disabled={starting}>
            {starting ? 'Starting…' : 'Start Reconciliation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Reconcile Workspace ───────────────────────────────────────────────────────

function ReconcileWorkspace({
  recon,
  transactions,
  onClose,
  closing,
}: {
  recon: Reconciliation;
  transactions: BankTransaction[];
  onClose: (reconId: number, markedTxIds: number[]) => void;
  closing: boolean;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (checked.size === transactions.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(transactions.map((t) => t.id)));
    }
  };

  // Running balance from checked transactions
  const clearedBalance = transactions
    .filter((t) => checked.has(t.id))
    .reduce((acc, t) => {
      const amt = parseFloat(t.amount);
      return acc + (t.type === 'credit' ? amt : -amt);
    }, 0);

  const statementBalance = parseFloat(recon.statementBalance);
  const difference = statementBalance - clearedBalance;
  const balanced = Math.abs(difference) < 0.01;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Reconciliation — Statement Date: {recon.statementDate}
          </h3>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">
            In Progress
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Statement Balance</p>
            <p className="font-mono font-semibold">
              ${statementBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cleared Balance</p>
            <p className="font-mono font-semibold">
              ${clearedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Difference</p>
            <p
              className={`font-mono font-semibold ${balanced ? 'text-green-700' : 'text-orange-600'}`}
            >
              ${difference.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              {balanced && ' ✓'}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          disabled={closing}
          variant={balanced ? 'default' : 'outline'}
          onClick={() => onClose(recon.id, Array.from(checked))}
        >
          {closing ? 'Closing…' : balanced ? 'Close Reconciliation ✓' : 'Close Anyway'}
        </Button>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unreconciled transactions.</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={checked.size === transactions.length && transactions.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-center font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`cursor-pointer ${checked.has(tx.id) ? 'bg-blue-50' : 'hover:bg-muted/20'}`}
                  onClick={() => toggle(tx.id)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked.has(tx.id)}
                      onChange={() => toggle(tx.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{tx.date}</td>
                  <td className="px-3 py-2 max-w-sm truncate">{tx.description}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span
                      className={tx.type === 'credit' ? 'text-green-700 font-medium' : 'text-red-600'}
                    >
                      {tx.type === 'credit' ? '+' : '-'}$
                      {parseFloat(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        tx.type === 'credit'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
