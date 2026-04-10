import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronDown, ChevronRight, Send, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { journalApi, type JournalEntry, type JournalEntryDetail } from '@/services/journalService';
import { accountApi, type Account } from '@/services/accountService';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  accountId: z.coerce.number().int().positive('Select an account'),
  debit: z.string().default('0.00'),
  credit: z.string().default('0.00'),
  memo: z.string().max(500).optional(),
});

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  description: z.string().min(1, 'Required'),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(2, 'Need at least 2 lines'),
});

type EntryForm = z.infer<typeof entrySchema>;

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  posted: 'bg-green-100 text-green-800',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reverseTarget, setReverseTarget] = useState<number | null>(null);
  const [reverseDate, setReverseDate] = useState(TODAY);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: accountList = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountApi.getAll().then((r) => r.data.data.accounts),
  });

  const { data: journalData, isLoading } = useQuery({
    queryKey: ['journal', page],
    queryFn: () => journalApi.getAll(page).then((r) => r.data.data as { entries: JournalEntry[]; total: number; limit: number }),
  });

  const { data: detail } = useQuery<JournalEntryDetail>({
    queryKey: ['journal-entry', expandedId],
    queryFn: () => journalApi.getOne(expandedId!).then((r) => r.data.data.entry),
    enabled: expandedId !== null,
  });

  const postMutation = useMutation({
    mutationFn: (id: number) => journalApi.post(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to post entry.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => journalApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal'] }); if (expandedId) setExpandedId(null); },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to delete entry.'),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => journalApi.reverse(id, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal'] });
      setReverseTarget(null);
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to reverse entry.'),
  });

  const entries = journalData?.entries ?? [];
  const total = journalData?.total ?? 0;
  const limit = journalData?.limit ?? 50;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">General Ledger</h1>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-muted-foreground">✕</button>
        </div>
      )}

      {/* Reversal date picker */}
      {reverseTarget !== null && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-4 pt-4">
            <span className="text-sm font-medium">Reversal date:</span>
            <Input
              type="date"
              className="w-40"
              value={reverseDate}
              onChange={(e) => setReverseDate(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => reverseMutation.mutate({ id: reverseTarget, date: reverseDate })}
              disabled={reverseMutation.isPending}
            >
              Confirm Reversal
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <NewEntryForm
          accounts={accountList}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['journal'] }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Journal entry list */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading entries...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No journal entries yet. Create your first entry above.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-6 px-4 py-3" />
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {expandedId === entry.id
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.date}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{entry.description}</span>
                      {entry.reversalOfId && (
                        <span className="ml-2 text-xs text-amber-600">reversal</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${parseFloat(entry.totalDebits).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-700')}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {entry.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Post"
                              onClick={() => postMutation.mutate(entry.id)}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              title="Delete"
                              onClick={() => { if (confirm('Delete this draft entry?')) deleteMutation.mutate(entry.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {entry.status === 'posted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reverse"
                            onClick={() => { setReverseTarget(entry.id); setReverseDate(TODAY); }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail rows */}
                  {expandedId === entry.id && detail?.id === entry.id && (
                    <tr key={`detail-${entry.id}`}>
                      <td colSpan={7} className="bg-slate-50 px-8 py-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="pb-1 text-left font-medium w-24">Code</th>
                              <th className="pb-1 text-left font-medium">Account</th>
                              <th className="pb-1 text-left font-medium">Memo</th>
                              <th className="pb-1 text-right font-medium w-28">Debit</th>
                              <th className="pb-1 text-right font-medium w-28">Credit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {detail.lines.map((line) => (
                              <tr key={line.id}>
                                <td className="py-1 font-mono text-muted-foreground">{line.accountCode}</td>
                                <td className="py-1">{line.accountName}</td>
                                <td className="py-1 text-muted-foreground">{line.memo ?? ''}</td>
                                <td className="py-1 text-right font-mono">
                                  {parseFloat(line.debit) > 0
                                    ? `$${parseFloat(line.debit).toFixed(2)}`
                                    : ''}
                                </td>
                                <td className="py-1 text-right font-mono">
                                  {parseFloat(line.credit) > 0
                                    ? `$${parseFloat(line.credit).toFixed(2)}`
                                    : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{total} entries total</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="flex items-center text-sm px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Entry Form ───────────────────────────────────────────────────────────

function NewEntryForm({
  accounts,
  onSuccess,
  onCancel,
}: {
  accounts: Account[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: TODAY,
      description: '',
      reference: '',
      lines: [
        { accountId: 0, debit: '', credit: '', memo: '' },
        { accountId: 0, debit: '', credit: '', memo: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');

  const totalDebits = lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0);
  const totalCredits = lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.005;

  const onSubmit = async (data: EntryForm) => {
    try {
      setError(null);
      await journalApi.create(data);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create entry.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Journal Entry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {/* Header fields */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" {...register('date')} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input placeholder="e.g. Monthly rent payment" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input placeholder="e.g. INV-001" {...register('reference')} />
          </div>
        </div>

        {/* Line items */}
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Memo</th>
                <th className="px-3 py-2 text-right font-medium w-28">Debit</th>
                <th className="px-3 py-2 text-right font-medium w-28">Credit</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field, i) => (
                <tr key={field.id}>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      {...register(`lines.${i}.accountId`)}
                    >
                      <option value="">Select account...</option>
                      {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map((type) => (
                        <optgroup key={type} label={type + 's'}>
                          {accounts
                            .filter((a) => a.typeName === type && a.isActive)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    {errors.lines?.[i]?.accountId && (
                      <p className="text-xs text-destructive mt-0.5">{errors.lines[i]?.accountId?.message}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 text-sm"
                      placeholder="Optional note"
                      {...register(`lines.${i}.memo`)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 text-sm text-right font-mono"
                      placeholder="0.00"
                      {...register(`lines.${i}.debit`)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 text-sm text-right font-mono"
                      placeholder="0.00"
                      {...register(`lines.${i}.credit`)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {fields.length > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td colSpan={2} className="px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => append({ accountId: 0, debit: '', credit: '', memo: '' })}
                  >
                    <Plus className="h-3 w-3" /> Add line
                  </Button>
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium">
                  ${totalDebits.toFixed(2)}
                </td>
                <td className={cn('px-3 py-2 text-right font-mono font-medium', !isBalanced && totalCredits > 0 && 'text-destructive')}>
                  ${totalCredits.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {!isBalanced && (totalDebits > 0 || totalCredits > 0) && (
          <p className="text-sm text-destructive">
            Entry is not balanced — debits and credits must be equal (difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)})
          </p>
        )}

        {errors.lines && typeof errors.lines.message === 'string' && (
          <p className="text-sm text-destructive">{errors.lines.message}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting || !isBalanced}>
            {isSubmitting ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
