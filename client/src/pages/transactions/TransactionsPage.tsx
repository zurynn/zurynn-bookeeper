import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { transactionService, TransactionPayload } from '@/services/transactionService';

const schema = z.object({
  type: z.enum(['income', 'expense']),
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 150.00)'),
  category: z.string().min(1, 'Category is required'),
});

type FormValues = z.infer<typeof schema>;

function fmt(val: string) {
  const n = parseFloat(val);
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: categoriesData } = useQuery({
    queryKey: ['tx-categories'],
    queryFn: transactionService.categories,
    staleTime: Infinity,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionService.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: TransactionPayload) => transactionService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteConfirm(null);
    },
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'income', date: new Date().toISOString().slice(0, 10) },
  });

  const selectedType = watch('type');
  const categories = selectedType === 'income'
    ? (categoriesData?.income ?? [])
    : (categoriesData?.expense ?? []);

  function onSubmit(values: FormValues) {
    createMutation.mutate(values);
  }

  function openModal() {
    reset({ type: 'income', date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: '' });
    setShowModal(true);
  }

  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button onClick={openModal}>
          <Plus className="h-4 w-4 mr-2" /> Add Transaction
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground font-medium">
            All income and expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Loading…</p>
          ) : !transactions.length ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No transactions yet. Click <strong>Add Transaction</strong> to record your first income or expense.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground">{tx.date}</td>
                    <td className="px-4 py-2.5 font-medium">{tx.description}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{tx.category}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${tx.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                      {tx.type === 'expense' ? '-' : ''}{fmt(tx.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {tx.type === 'income' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          <TrendingUp className="h-3 w-3" /> Income
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          <TrendingDown className="h-3 w-3" /> Expense
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {deleteConfirm === tx.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-muted-foreground">Delete?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 text-xs"
                            onClick={() => deleteMutation.mutate(tx.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Yes
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDeleteConfirm(null)}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(tx.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add Transaction</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Type toggle */}
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <div className="flex rounded-lg border overflow-hidden">
                  {(['income', 'expense'] as const).map((t) => (
                    <label
                      key={t}
                      className={`flex-1 text-center py-2 text-sm font-medium cursor-pointer transition-colors ${
                        selectedType === t
                          ? t === 'income' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                          : 'bg-white text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <input {...register('type')} type="radio" value={t} className="sr-only" />
                      {t === 'income' ? 'Income' : 'Expense'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  {...register('date')}
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  {...register('description')}
                  type="text"
                  placeholder="e.g. Client payment for website"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    {...register('amount')}
                    type="text"
                    placeholder="0.00"
                    className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  {...register('category')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
              </div>

              {createMutation.error && (
                <p className="text-sm text-red-600">
                  {(createMutation.error as any)?.response?.data?.error ?? 'Something went wrong.'}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving…' : 'Save Transaction'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
