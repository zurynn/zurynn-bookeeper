import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronDown, ChevronRight, Send, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { invoiceApi, type Invoice } from '@/services/invoiceService';
import { customerApi, type Customer } from '@/services/customerService';
import { cn } from '@/lib/utils';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  description: z.string().min(1, 'Required'),
  quantity: z.string().default('1.00'),
  unitPrice: z.string().min(1, 'Required'),
  taxRate: z.string().default('0.0000'),
});

const createSchema = z.object({
  customerId: z.coerce.number().int().positive('Select a customer'),
  date: z.string().min(1, 'Required'),
  dueDate: z.string().min(1, 'Required'),
  notes: z.string().optional(),
  terms: z.string().optional(),
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
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ['invoices', page],
    queryFn: () => invoiceApi.getAll(page).then((r) => r.data.data as { invoices: Invoice[]; total: number; limit: number }),
  });

  const { data: detail } = useQuery<Invoice>({
    queryKey: ['invoice', expandedId],
    queryFn: () => invoiceApi.getOne(expandedId!).then((r) => r.data.data.invoice),
    enabled: expandedId !== null,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll().then((r) => r.data.data.customers),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => invoiceApi.send(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice', expandedId] }); },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to send invoice.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoiceApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setExpandedId(null); },
    onError: (e: any) => setError(e.response?.data?.error || 'Failed to void invoice.'),
  });

  const invoices = invoiceData?.invoices ?? [];
  const total = invoiceData?.total ?? 0;
  const limit = invoiceData?.limit ?? 50;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex justify-between">
          <span>{error}</span><button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showForm && (
        <InvoiceForm
          customers={customers}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Payment modal overlay */}
      {payingId !== null && (
        <PaymentModal
          invoiceId={payingId}
          invoice={invoices.find((i) => i.id === payingId) ?? detail}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['invoices'] });
            qc.invalidateQueries({ queryKey: ['invoice', payingId] });
            qc.invalidateQueries({ queryKey: ['customers'] });
            setPayingId(null);
          }}
          onCancel={() => setPayingId(null)}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : invoices.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No invoices yet. Create your first invoice above.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-6 px-4 py-3" />
                <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <>
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {expandedId === inv.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${parseFloat(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={parseFloat(inv.total) - parseFloat(inv.amountPaid) > 0 ? 'text-orange-600' : 'text-green-600'}>
                        ${(parseFloat(inv.total) - parseFloat(inv.amountPaid)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[inv.status] ?? 'bg-gray-100 text-gray-700')}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {inv.status === 'draft' && (
                          <>
                            <Button variant="ghost" size="sm" title="Send" onClick={() => sendMutation.mutate(inv.id)}>
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => { if (confirm('Void this invoice?')) deleteMutation.mutate(inv.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {(inv.status === 'sent' || inv.status === 'partial') && (
                          <Button variant="ghost" size="sm" title="Record payment" onClick={() => setPayingId(inv.id)}>
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedId === inv.id && detail?.id === inv.id && (
                    <tr key={`detail-${inv.id}`}>
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
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{total} invoices</span>
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

// ─── Invoice Create Form ──────────────────────────────────────────────────────

function InvoiceForm({ customers, onSuccess, onCancel }: { customers: Customer[]; onSuccess: () => void; onCancel: () => void }) {
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
      await invoiceApi.create({
        ...data,
        items: data.items.map((item) => ({
          ...item,
          taxRate: (parseFloat(item.taxRate || '0') / 100).toFixed(4),
        })),
      });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create invoice.');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New Invoice</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Customer *</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('customerId')}
            >
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Invoice Date *</Label>
            <Input type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label>Due Date *</Label>
            <Input type="date" {...register('dueDate')} />
          </div>
        </div>

        {/* Line items */}
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
          <Input placeholder="Optional notes for the customer" {...register('notes')} />
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Invoice'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ invoiceId, invoice, onSuccess, onCancel }: {
  invoiceId: number;
  invoice?: Invoice;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const remaining = invoice ? (parseFloat(invoice.total) - parseFloat(invoice.amountPaid)).toFixed(2) : '0.00';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date: TODAY, amount: remaining, method: 'bank' },
  });

  const onSubmit = async (data: PaymentForm) => {
    try {
      setError(null);
      await invoiceApi.recordPayment(invoiceId, data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to record payment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
          {invoice && (
            <p className="text-sm text-muted-foreground">
              Invoice {invoice.invoiceNumber} · Balance: ${remaining}
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
