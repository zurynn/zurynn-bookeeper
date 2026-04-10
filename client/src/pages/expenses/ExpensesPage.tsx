import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronDown, ChevronRight, CheckCircle, Ban, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { expenseApi, expenseAttachmentApi, type Expense, type ExpenseAttachment } from '@/services/expenseService';
import { vendorApi, type Vendor } from '@/services/vendorService';
import { accountApi } from '@/services/accountService';
import { companyApi, type TaxSetting } from '@/services/companyService';
import { cn } from '@/lib/utils';

const UPLOAD_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
const TODAY = new Date().toISOString().slice(0, 10);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  expenseAccountId: z.coerce.number().int().positive('Select an account'),
  description: z.string().min(1, 'Required'),
  amount: z.string().min(1, 'Required'),
  taxCodeId: z.coerce.number().int().positive().nullable().optional(),
  taxAmount: z.string().default('0.00'),
});

const createSchema = z.object({
  vendorId: z.coerce.number().int().positive().nullable().optional(),
  paymentAccountId: z.coerce.number().int().positive('Select a payment account'),
  date: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});

type CreateForm = z.infer<typeof createSchema>;

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  posted: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: expenseData, isLoading } = useQuery({
    queryKey: ['expenses', page],
    queryFn: () => expenseApi.getAll(page).then((r) => r.data.data as { expenses: Expense[]; total: number; limit: number }),
  });

  const { data: detail } = useQuery<Expense>({
    queryKey: ['expense', expandedId],
    queryFn: () => expenseApi.getOne(expandedId!).then((r) => r.data.data.expense),
    enabled: expandedId !== null,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.getAll().then((r) => r.data.data.vendors),
  });

  const { data: allAccounts = [] } = useQuery<any[]>({
    queryKey: ['accounts'],
    queryFn: () => accountApi.getAll().then((r) => r.data.data.accounts),
  });

  const { data: taxCodes = [] } = useQuery<TaxSetting[]>({
    queryKey: ['tax-settings'],
    queryFn: () => companyApi.getTaxSettings().then((r) => r.data.data.taxSettings),
  });

  const assetAccounts = allAccounts.filter((a) => a.typeName === 'Asset' && a.isActive);

  const postMutation = useMutation({
    mutationFn: (id: number) => expenseApi.post(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense', expandedId] });
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to post expense.'),
  });

  const voidMutation = useMutation({
    mutationFn: (id: number) => expenseApi.void(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense', expandedId] });
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to void expense.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expenseApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setExpandedId(null); },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to delete expense.'),
  });

  const expenseList = expenseData?.expenses ?? [];
  const total = expenseData?.total ?? 0;
  const limit = expenseData?.limit ?? 50;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> New Expense
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex justify-between">
          <span>{error}</span><button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showForm && (
        <ExpenseForm
          vendors={vendors}
          allAccounts={allAccounts}
          assetAccounts={assetAccounts}
          taxCodes={taxCodes}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : expenseList.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No expenses yet. Record your first expense above.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-6 px-4 py-3" />
                <th className="px-4 py-3 text-left font-medium">Expense #</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Paid From</th>
                <th className="px-4 py-3 text-right font-medium">Tax</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenseList.map((exp) => (
                <>
                  <tr
                    key={exp.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {expandedId === exp.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{exp.expenseNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{exp.date}</td>
                    <td className="px-4 py-3 truncate max-w-[180px]">{exp.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{exp.vendorName ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{exp.paymentAccountName}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${parseFloat(exp.taxAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      ${parseFloat(exp.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[exp.status] ?? 'bg-gray-100 text-gray-700')}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {exp.status === 'draft' && (
                          <>
                            <Button variant="ghost" size="sm" title="Post" onClick={() => postMutation.mutate(exp.id)}>
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => { if (confirm('Delete this draft expense?')) deleteMutation.mutate(exp.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {exp.status === 'posted' && (
                          <Button
                            variant="ghost" size="sm"
                            className="text-destructive hover:text-destructive"
                            title="Void"
                            onClick={() => { if (confirm('Void this expense? A reversing journal entry will be created.')) voidMutation.mutate(exp.id); }}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedId === exp.id && detail?.id === exp.id && (
                    <tr key={`detail-${exp.id}`}>
                      <td colSpan={10} className="bg-slate-50 px-8 py-4 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="pb-1 text-left font-medium">Description</th>
                              <th className="pb-1 text-left font-medium">Account</th>
                              <th className="pb-1 text-left font-medium">Tax Code</th>
                              <th className="pb-1 text-right font-medium w-24">Amount</th>
                              <th className="pb-1 text-right font-medium w-24">Tax</th>
                              <th className="pb-1 text-right font-medium w-24">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {detail.lines?.map((line, i) => (
                              <tr key={i}>
                                <td className="py-1">{line.description}</td>
                                <td className="py-1 text-muted-foreground">{line.expenseAccountName}</td>
                                <td className="py-1 text-muted-foreground">{line.taxCodeName ?? '—'}</td>
                                <td className="py-1 text-right font-mono">${parseFloat(line.amount).toFixed(2)}</td>
                                <td className="py-1 text-right font-mono">${parseFloat(line.taxAmount).toFixed(2)}</td>
                                <td className="py-1 text-right font-mono">
                                  ${(parseFloat(line.amount) + parseFloat(line.taxAmount)).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-medium">
                              <td colSpan={5} className="pt-2 text-right text-muted-foreground">Subtotal</td>
                              <td className="pt-2 text-right font-mono">${parseFloat(detail.subtotal).toFixed(2)}</td>
                            </tr>
                            {parseFloat(detail.taxAmount) > 0 && (
                              <tr>
                                <td colSpan={5} className="text-right text-muted-foreground">Tax</td>
                                <td className="text-right font-mono">${parseFloat(detail.taxAmount).toFixed(2)}</td>
                              </tr>
                            )}
                            <tr className="text-sm font-bold">
                              <td colSpan={5} className="pt-1 text-right">Total</td>
                              <td className="pt-1 text-right font-mono">${parseFloat(detail.total).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>

                        {detail.notes && (
                          <p className="text-xs text-muted-foreground pt-1"><span className="font-medium">Notes:</span> {detail.notes}</p>
                        )}

                        <ExpenseAttachmentsSection expenseId={exp.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{total} expenses</span>
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

// ─── Expense Create Form ───────────────────────────────────────────────────────

function ExpenseForm({
  vendors,
  allAccounts,
  assetAccounts,
  taxCodes,
  onSuccess,
  onCancel,
}: {
  vendors: Vendor[];
  allAccounts: any[];
  assetAccounts: any[];
  taxCodes: TaxSetting[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const expenseAccounts = allAccounts.filter((a) => a.typeName === 'Expense' && a.isActive);
  const activeTaxCodes = taxCodes.filter((t) => t.isActive);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      date: TODAY,
      lines: [{ expenseAccountId: 0, description: '', amount: '', taxCodeId: null, taxAmount: '0.00' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');

  // Recompute tax amount when line amount or tax code changes
  const handleTaxCodeChange = (index: number, taxCodeId: string) => {
    const id = parseInt(taxCodeId, 10);
    const taxCode = activeTaxCodes.find((t) => t.id === id);
    const amount = parseFloat(watchedLines[index]?.amount || '0');
    if (taxCode && !isNaN(amount)) {
      const tax = (amount * parseFloat(taxCode.taxRate)).toFixed(2);
      setValue(`lines.${index}.taxAmount`, tax);
    } else {
      setValue(`lines.${index}.taxAmount`, '0.00');
    }
  };

  const handleAmountChange = (index: number, amount: string) => {
    const taxCodeId = watchedLines[index]?.taxCodeId;
    const taxCode = activeTaxCodes.find((t) => t.id === taxCodeId);
    if (taxCode) {
      const tax = (parseFloat(amount || '0') * parseFloat(taxCode.taxRate)).toFixed(2);
      setValue(`lines.${index}.taxAmount`, tax);
    }
  };

  const subtotal = watchedLines.reduce((s, l) => s + parseFloat(l.amount || '0'), 0);
  const totalTax = watchedLines.reduce((s, l) => s + parseFloat(l.taxAmount || '0'), 0);

  const onSubmit = async (data: CreateForm) => {
    try {
      setError(null);
      await expenseApi.create({
        ...data,
        vendorId: data.vendorId || null,
      });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create expense.');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New Expense</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" {...register('date')} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Description *</Label>
            <Input placeholder="Office supplies, travel, etc." {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Paid From *</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('paymentAccountId')}
            >
              <option value="">Select account...</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            {errors.paymentAccountId && <p className="text-xs text-destructive">{errors.paymentAccountId.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vendor (optional)</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('vendorId')}
          >
            <option value="">No vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {/* Line items */}
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium w-44">Expense Account</th>
                <th className="px-3 py-2 text-right font-medium w-28">Amount</th>
                <th className="px-3 py-2 text-left font-medium w-36">Tax Code</th>
                <th className="px-3 py-2 text-right font-medium w-24">Tax</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field, i) => (
                <tr key={field.id}>
                  <td className="px-3 py-2">
                    <Input className="h-8 text-sm" {...register(`lines.${i}.description`)} />
                    {errors.lines?.[i]?.description && (
                      <p className="text-xs text-destructive">{errors.lines[i]?.description?.message}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...register(`lines.${i}.expenseAccountId`)}
                    >
                      <option value="">Account...</option>
                      {expenseAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                    {errors.lines?.[i]?.expenseAccountId && (
                      <p className="text-xs text-destructive">{errors.lines[i]?.expenseAccountId?.message}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 text-sm text-right font-mono"
                      placeholder="0.00"
                      {...register(`lines.${i}.amount`, {
                        onChange: (e) => handleAmountChange(i, e.target.value),
                      })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...register(`lines.${i}.taxCodeId`, {
                        onChange: (e) => handleTaxCodeChange(i, e.target.value),
                      })}
                    >
                      <option value="">No tax</option>
                      {activeTaxCodes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.taxName} ({(parseFloat(t.taxRate) * 100).toFixed(2)}%)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-muted-foreground">
                    ${parseFloat(watchedLines[i]?.taxAmount || '0').toFixed(2)}
                    <input type="hidden" {...register(`lines.${i}.taxAmount`)} />
                  </td>
                  <td className="px-3 py-2">
                    {fields.length > 1 && (
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
                    type="button" variant="ghost" size="sm" className="gap-1 text-xs"
                    onClick={() => append({ expenseAccountId: 0, description: '', amount: '', taxCodeId: null, taxAmount: '0.00' })}
                  >
                    <Plus className="h-3 w-3" /> Add line
                  </Button>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">Subtotal</td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">Tax</td>
                <td className="px-3 py-2 text-right font-mono font-medium text-xs" colSpan={2}>
                  ${subtotal.toFixed(2)} + ${totalTax.toFixed(2)} = ${(subtotal + totalTax).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Input placeholder="Optional notes" {...register('notes')} />
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Attachments Section ───────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ExpenseAttachmentsSection({ expenseId }: { expenseId: number }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ExpenseAttachment[]>({
    queryKey: ['expense-attachments', expenseId],
    queryFn: () => expenseAttachmentApi.list(expenseId).then((r) => r.data.data.attachments),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => expenseAttachmentApi.upload(expenseId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-attachments', expenseId] });
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => setUploadError(e.response?.data?.error || 'Upload failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => expenseAttachmentApi.remove(expenseId, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-attachments', expenseId] }),
    onError: (e: any) => setUploadError(e.response?.data?.error || 'Delete failed.'),
  });

  const attachments = data ?? [];

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> Attachments
        </p>
        <Button
          type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? 'Uploading...' : '+ Attach Receipt'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
          }}
        />
      </div>

      {uploadError && (
        <div className="mb-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive flex justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>✕</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No receipts attached.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => {
            const isImage = a.mimeType.startsWith('image/');
            const fileUrl = `${UPLOAD_BASE}/uploads/expenses/${a.storedName}`;
            return (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                {isImage ? (
                  <img src={fileUrl} alt={a.originalName} className="h-10 w-10 rounded object-cover border border-slate-200 flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center rounded border border-slate-200 bg-slate-50 flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-blue-600 hover:underline" title={a.originalName}>
                  {a.originalName}
                </a>
                <span className="text-muted-foreground whitespace-nowrap">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80"
                  onClick={() => { if (confirm('Delete this attachment?')) deleteMutation.mutate(a.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
