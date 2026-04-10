import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { accountApi, type Account, type AccountType } from '@/services/accountService';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const addSchema = z.object({
  accountTypeId: z.coerce.number().int().positive('Required'),
  code: z.string().min(1, 'Required').max(20),
  name: z.string().min(1, 'Required').max(255),
  description: z.string().max(500).optional(),
});

const editSchema = z.object({
  code: z.string().min(1, 'Required').max(20),
  name: z.string().min(1, 'Required').max(255),
  description: z.string().max(500).optional(),
});

type AddForm = z.infer<typeof addSchema>;
type EditForm = z.infer<typeof editSchema>;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountApi.getAll().then((r) => r.data.data.accounts),
  });

  const { data: types = [] } = useQuery<AccountType[]>({
    queryKey: ['account-types'],
    queryFn: () => accountApi.getTypes().then((r) => r.data.data.types),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to delete account.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      accountApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  // Group accounts by type
  const grouped = TYPE_ORDER.reduce<Record<string, Account[]>>((acc, type) => {
    acc[type] = accounts.filter((a) => a.typeName === type);
    return acc;
  }, {});

  const typeTotal = (type: string) =>
    grouped[type]
      .filter((a) => a.isActive)
      .reduce((sum, a) => sum + parseFloat(a.balance), 0)
      .toFixed(2);

  const toggleCollapse = (type: string) =>
    setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));

  if (isLoading) return <div className="text-muted-foreground">Loading accounts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <Button onClick={() => { setShowAdd(!showAdd); setEditingId(null); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {showAdd && (
        <AddAccountForm
          types={types}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['accounts'] }); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Tree grouped by account type */}
      <div className="space-y-3">
        {TYPE_ORDER.map((type) => (
          <div key={type} className="rounded-lg border">
            {/* Group header */}
            <button
              onClick={() => toggleCollapse(type)}
              className="flex w-full items-center justify-between px-4 py-3 bg-muted/40 rounded-t-lg hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold">
                {collapsed[type] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {type}s
                <span className="text-xs font-normal text-muted-foreground">
                  ({grouped[type].length} accounts)
                </span>
              </div>
              <span className="font-mono text-sm font-medium">
                ${parseFloat(typeTotal(type)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </button>

            {!collapsed[type] && (
              <table className="w-full text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-24">Code</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground w-36">Balance</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground w-20">Status</th>
                    <th className="px-4 py-2 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grouped[type].length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                        No accounts in this category.
                      </td>
                    </tr>
                  ) : (
                    grouped[type].map((acct) => (
                      editingId === acct.id ? (
                        <EditAccountRow
                          key={acct.id}
                          account={acct}
                          onSuccess={() => { qc.invalidateQueries({ queryKey: ['accounts'] }); setEditingId(null); }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <tr key={acct.id} className={cn('hover:bg-muted/20', !acct.isActive && 'opacity-50')}>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">{acct.code}</td>
                          <td className="px-4 py-2.5 font-medium">
                            {acct.name}
                            {acct.isSystem && (
                              <span className="ml-2 text-xs text-muted-foreground">(system)</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            ${parseFloat(acct.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant={acct.isActive ? 'default' : 'secondary'}>
                              {acct.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingId(acct.id)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleMutation.mutate({ id: acct.id, isActive: !acct.isActive })}
                                title={acct.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <span className="text-xs">{acct.isActive ? '✕' : '✓'}</span>
                              </Button>
                              {!acct.isSystem && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Delete "${acct.name}"?`)) deleteMutation.mutate(acct.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add Account Form ─────────────────────────────────────────────────────────

function AddAccountForm({
  types,
  onSuccess,
  onCancel,
}: {
  types: AccountType[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
  });

  const onSubmit = async (data: AddForm) => {
    try {
      setError(null);
      await accountApi.create(data);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account.');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New Account</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('accountTypeId')}
              >
                <option value="">Select...</option>
                {TYPE_ORDER.map((t) => {
                  const type = types.find((x) => x.name === t);
                  return type ? <option key={type.id} value={type.id}>{type.name}</option> : null;
                })}
              </select>
              {errors.accountTypeId && <p className="text-sm text-destructive">{errors.accountTypeId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input placeholder="e.g. 1050" {...register('code')} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Petty Cash" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

function EditAccountRow({
  account,
  onSuccess,
  onCancel,
}: {
  account: Account;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { code: account.code, name: account.name, description: account.description ?? '' },
  });

  const onSubmit = async (data: EditForm) => {
    await accountApi.update(account.id, data);
    onSuccess();
  };

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <Input className="h-8 text-sm font-mono" {...register('code')} />
      </td>
      <td className="px-4 py-2" colSpan={2}>
        <Input className="h-8 text-sm" {...register('name')} />
      </td>
      <td />
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <Button size="sm" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>✕</Button>
        </div>
      </td>
    </tr>
  );
}
