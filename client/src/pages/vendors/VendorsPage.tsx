import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { vendorApi, type Vendor } from '@/services/vendorService';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function VendorsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.getAll().then((r) => r.data.data.vendors),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vendorApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
    onError: (e: any) => setError(e.response?.data?.error || 'Delete failed.'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex justify-between">
          <span>{error}</span><button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showForm && (
        <VendorForm
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['vendors'] }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : vendors.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No vendors yet. Add your first vendor above.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Balance Owed</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map((v) =>
                editingId === v.id ? (
                  <VendorEditRow
                    key={v.id}
                    vendor={v}
                    onSuccess={() => { qc.invalidateQueries({ queryKey: ['vendors'] }); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={v.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={parseFloat(v.balanceOwed) > 0 ? 'text-red-600 font-semibold' : ''}>
                        ${parseFloat(v.balanceOwed).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(v.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Delete ${v.name}?`)) deleteMutation.mutate(v.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await vendorApi.create(data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create vendor.');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New Vendor</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input {...register('city')} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input {...register('address')} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add Vendor'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function VendorEditRow({ vendor, onSuccess, onCancel }: { vendor: Vendor; onSuccess: () => void; onCancel: () => void }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: vendor.name, email: vendor.email ?? '', phone: vendor.phone ?? '' },
  });

  const onSubmit = async (data: FormData) => {
    await vendorApi.update(vendor.id, data);
    onSuccess();
  };

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2"><Input className="h-8 text-sm" {...register('name')} /></td>
      <td className="px-4 py-2"><Input className="h-8 text-sm" {...register('email')} /></td>
      <td className="px-4 py-2"><Input className="h-8 text-sm" {...register('phone')} /></td>
      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
        ${parseFloat(vendor.balanceOwed).toFixed(2)}
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end gap-1">
          <Button size="sm" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  );
}
