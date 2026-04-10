import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronDown, ChevronRight, CheckCircle, DollarSign, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { billApi, attachmentApi, type Bill, type BillAttachment } from '@/services/billService';
import { vendorApi, type Vendor } from '@/services/vendorService';
import { cn } from '@/lib/utils';

const UPLOAD_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

// ─── Schemas ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  description: z.string().min(1, 'Required'),
  quantity: z.string().default('1.00'),
  unitPrice: z.string().min(1, 'Required'),
  taxRate: z.string().default('0.0000'),
});

const createSchema = z.object({
  vendorId: z.coerce.number().int().positive('Select a vendor'),
  date: z.string().min(1, 'Required'),
  dueDate: z.string().min(1, 'Required'),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});

const paymentSchema = z.object({
  date: z.string().min(1, 'Required'),
  amount: z.string().min(1, 'Required'),
  method: z.enum(['bank', 'cash', 'check', 'credit_card', 'other']),
  reference: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: billData, isLoading } = useQuery({
    queryKey: ['bills', page],
    queryFn: () => billApi.getAll(page).then((r) => r.data.data as { bills: Bill[]; total: number; limit: number }),
  });

  const { data: detail } = useQuery<Bill>({
    queryKey: ['bill', expandedId],
    queryFn: () => billApi.getOne(expandedId!).then((r) => r.data.data.bill),
    enabled: expandedId !== null,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.getAll().then((r) => r.data.data.vendors),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => billApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['bill', expandedId] }); },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to approve bill.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => billApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); setExpandedId(null); },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to void bill.'),
  });

  const bills = billData?.bills ?? [];
  const total = billData?.total ?? 0;
  const limit = billData?.limit ?? 50;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bills</h1>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> New Bill
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex justify-between">
          <span>{error}</span><button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showForm && (
        <BillForm
          vendors={vendors}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['bills'] }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {payingId !== null && (
        <PaymentModal
          billId={payingId}
          bill={bills.find((b) => b.id === payingId) ?? detail}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['bills'] });
            qc.invalidateQueries({ queryKey: ['bill', payingId] });
            qc.invalidateQueries({ queryKey: ['vendors'] });
            setPayingId(null);
          }}
          onCancel={() => setPayingId(null)}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : bills.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No bills yet. Create your first bill above.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-6 px-4 py-3" />
                <th className="px-4 py-3 text-left font-medium">Bill #</th>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {bills.map((bill) => (
                <>
                  <tr
                    key={bill.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {expandedId === bill.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{bill.billNumber}</td>
                    <td className="px-4 py-3">{bill.vendorName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bill.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bill.dueDate}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${parseFloat(bill.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={parseFloat(bill.total) - parseFloat(bill.amountPaid) > 0 ? 'text-red-600' : 'text-green-600'}>
                        ${(parseFloat(bill.total) - parseFloat(bill.amountPaid)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[bill.status] ?? 'bg-gray-100 text-gray-700')}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {bill.status === 'draft' && (
                          <>
                            <Button variant="ghost" size="sm" title="Approve" onClick={() => approveMutation.mutate(bill.id)}>
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => { if (confirm('Void this bill?')) deleteMutation.mutate(bill.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {(bill.status === 'approved' || bill.status === 'partial') && (
                          <Button variant="ghost" size="sm" title="Record payment" onClick={() => setPayingId(bill.id)}>
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedId === bill.id && detail?.id === bill.id && (
                    <tr key={`detail-${bill.id}`}>
                      <td colSpan={9} className="bg-slate-50 px-8 py-4 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="pb-1 text-left font-medium">Description</th>
                              <th className="pb-1 text-right font-medium w-16">Qty</th>
                              <th className="pb-1 text-right font-medium w-24">Unit Price</th>
                              <th className="pb-1 text-right font-medium w-16">Tax %</th>
                              <th className="pb-1 text-right font-medium w-24">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {detail.items?.map((item, i) => (
                              <tr key={i}>
                                <td className="py-1">{item.description}</td>
                                <td className="py-1 text-right">{item.quantity}</td>
                                <td className="py-1 text-right font-mono">${parseFloat(item.unitPrice).toFixed(2)}</td>
                                <td className="py-1 text-right">{(parseFloat(item.taxRate) * 100).toFixed(1)}%</td>
                                <td className="py-1 text-right font-mono">${parseFloat(item.amount ?? '0').toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-medium">
                              <td colSpan={4} className="pt-2 text-right text-muted-foreground">Subtotal</td>
                              <td className="pt-2 text-right font-mono">${parseFloat(detail.subtotal).toFixed(2)}</td>
                            </tr>
                            {parseFloat(detail.taxAmount) > 0 && (
                              <tr>
                                <td colSpan={4} className="text-right text-muted-foreground">Tax</td>
                                <td className="text-right font-mono">${parseFloat(detail.taxAmount).toFixed(2)}</td>
                              </tr>
                            )}
                            <tr className="text-sm font-bold">
                              <td colSpan={4} className="pt-1 text-right">Total</td>
                              <td className="pt-1 text-right font-mono">${parseFloat(detail.total).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>

                        {detail.payments && detail.payments.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Payments</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="pb-1 text-left font-medium">Date</th>
                                  <th className="pb-1 text-left font-medium">Method</th>
                                  <th className="pb-1 text-left font-medium">Reference</th>
                                  <th className="pb-1 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {detail.payments.map((p) => (
                                  <tr key={p.id}>
                                    <td className="py-1">{p.date}</td>
                                    <td className="py-1 capitalize">{p.method.replace('_', ' ')}</td>
                                    <td className="py-1 text-muted-foreground">{p.reference ?? '—'}</td>
                                    <td className="py-1 text-right font-mono">${parseFloat(p.amount).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}

                        <BillAttachmentsSection billId={bill.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{total} bills</span>
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

// ─── Bill Attachments Section ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BillAttachmentsSection({ billId }: { billId: number }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BillAttachment[]>({
    queryKey: ['bill-attachments', billId],
    queryFn: () => attachmentApi.list(billId).then((r) => r.data.data.attachments),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentApi.upload(billId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-attachments', billId] });
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => setUploadError(e.response?.data?.error || 'Upload failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => attachmentApi.remove(billId, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bill-attachments', billId] }),
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
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? 'Uploading...' : '+ Attach File'}
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
        <p className="text-xs text-muted-foreground italic">No attachments.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => {
            const isImage = a.mimeType.startsWith('image/');
            const fileUrl = `${UPLOAD_BASE}/uploads/bills/${a.storedName}`;
            return (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                {isImage ? (
                  <img
                    src={fileUrl}
                    alt={a.originalName}
                    className="h-10 w-10 rounded object-cover border border-slate-200 flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center rounded border border-slate-200 bg-slate-50 flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-blue-600 hover:underline"
                  title={a.originalName}
                >
                  {a.originalName}
                </a>
                <span className="text-muted-foreground whitespace-nowrap">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80"
                  title="Delete attachment"
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

// ─── Bill Create Form ─────────────────────────────────────────────────────────

function BillForm({ vendors, onSuccess, onCancel }: { vendors: Vendor[]; onSuccess: () => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      date: TODAY,
      dueDate: TODAY,
      items: [{ description: '', quantity: '1.00', unitPrice: '', taxRate: '0' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const subtotal = items.reduce((s, item) => s + (parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0')), 0);

  const onSubmit = async (data: CreateForm) => {
    try {
      setError(null);
      await billApi.create({
        ...data,
        items: data.items.map((item) => ({
          ...item,
          taxRate: (parseFloat(item.taxRate || '0') / 100).toFixed(4),
        })),
      });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create bill.');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New Bill</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Vendor *</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('vendorId')}
            >
              <option value="">Select vendor...</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {errors.vendorId && <p className="text-xs text-destructive">{errors.vendorId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Bill Date *</Label>
            <Input type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label>Due Date *</Label>
            <Input type="date" {...register('dueDate')} />
          </div>
        </div>

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium w-20">Qty</th>
                <th className="px-3 py-2 text-right font-medium w-28">Unit Price</th>
                <th className="px-3 py-2 text-right font-medium w-24">Tax %</th>
                <th className="px-3 py-2 text-right font-medium w-24">Amount</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field, i) => {
                const lineAmt = parseFloat(items[i]?.quantity || '0') * parseFloat(items[i]?.unitPrice || '0');
                return (
                  <tr key={field.id}>
                    <td className="px-3 py-2">
                      <Input className="h-8 text-sm" {...register(`items.${i}.description`)} />
                      {errors.items?.[i]?.description && (
                        <p className="text-xs text-destructive">{errors.items[i]?.description?.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8 text-sm text-right font-mono" {...register(`items.${i}.quantity`)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8 text-sm text-right font-mono" placeholder="0.00" {...register(`items.${i}.unitPrice`)} />
                      {errors.items?.[i]?.unitPrice && (
                        <p className="text-xs text-destructive">{errors.items[i]?.unitPrice?.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8 text-sm text-right font-mono" placeholder="8.25" {...register(`items.${i}.taxRate`)} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      {isNaN(lineAmt) ? '' : `$${lineAmt.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2">
                      {fields.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td colSpan={3} className="px-3 py-2">
                  <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs"
                    onClick={() => append({ description: '', quantity: '1.00', unitPrice: '', taxRate: '0' })}>
                    <Plus className="h-3 w-3" /> Add line
                  </Button>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">Subtotal</td>
                <td className="px-3 py-2 text-right font-mono font-medium">${subtotal.toFixed(2)}</td>
                <td />
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
            {isSubmitting ? 'Creating...' : 'Create Bill'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ billId, bill, onSuccess, onCancel }: {
  billId: number;
  bill?: Bill;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const remaining = bill ? (parseFloat(bill.total) - parseFloat(bill.amountPaid)).toFixed(2) : '0.00';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date: TODAY, amount: remaining, method: 'bank' },
  });

  const onSubmit = async (data: PaymentForm) => {
    try {
      setError(null);
      await billApi.recordPayment(billId, data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to record payment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Record Bill Payment</CardTitle>
          {bill && (
            <p className="text-sm text-muted-foreground">
              {bill.billNumber} · {bill.vendorName} · Balance: ${remaining}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" {...register('amount')} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('method')}
              >
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input placeholder="e.g. check #1234" {...register('reference')} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Record Payment'}
            </Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
