import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, UserPlus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { companyApi, type Company, type TaxSetting, type Member } from '@/services/companyService';
import { accountApi } from '@/services/accountService';
import { useCompanyStore } from '@/store/companyStore';
import { cn } from '@/lib/utils';

// ─── Schemas ────────────────────────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().min(1, 'Required').max(255),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  website: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  currency: z.string().length(3),
  fiscalYearStart: z.string().regex(/^\d{2}-\d{2}$/, 'Format: MM-DD'),
});

const taxSchema = z.object({
  taxName: z.string().min(1, 'Required'),
  taxRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Must be a number'),
  recoverablePercentage: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Must be 0–100').default('100'),
  recoverableAccountId: z.coerce.number().int().positive().nullable().optional(),
  liabilityAccountId: z.coerce.number().int().positive().nullable().optional(),
  appliesTo: z.enum(['sales', 'purchases', 'both']),
});

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'accountant', 'staff', 'readonly']),
});

type CompanyForm = z.infer<typeof companySchema>;
type TaxForm = z.infer<typeof taxSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

const TABS = ['Company Info', 'Tax Settings', 'Team'] as const;
type Tab = typeof TABS[number];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR'];
const INDUSTRIES = [
  'Accounting / Finance', 'Agriculture', 'Construction', 'Education',
  'Healthcare', 'Hospitality', 'Legal', 'Manufacturing',
  'Non-Profit', 'Real Estate', 'Retail', 'Technology', 'Transportation', 'Other',
];
const ROLES = ['admin', 'accountant', 'staff', 'readonly'] as const;

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CompanySettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Company Info');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Company Settings</h1>

      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'Company Info' && <CompanyInfoTab />}
      {activeTab === 'Tax Settings' && <TaxSettingsTab />}
      {activeTab === 'Team' && <TeamTab />}
    </div>
  );
}

// ─── Company Info Tab ────────────────────────────────────────────────────────

function CompanyInfoTab() {
  const { setCompany } = useCompanyStore();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyApi.getMe().then((r) => r.data.data.company as Company),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    values: data
      ? {
          name: data.name,
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          website: data.website ?? '',
          industry: data.industry ?? '',
          currency: data.currency,
          fiscalYearStart: data.fiscalYearStart,
        }
      : undefined,
  });

  const onSubmit = async (form: CompanyForm) => {
    try {
      setErrorMsg(null);
      const res = await companyApi.updateMe(form);
      const updated = res.data.data.company as Company;
      setCompany({ id: updated.id, name: updated.name, currency: updated.currency, fiscalYearStart: updated.fiscalYearStart });
      setSuccessMsg('Company settings saved.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to save settings.');
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {successMsg && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errorMsg}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Business Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Business Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register('address')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" placeholder="https://..." {...register('website')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('industry')}
              >
                <option value="">Select...</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accounting Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('currency')}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
              <Input id="fiscalYearStart" placeholder="01-01" {...register('fiscalYearStart')} />
              <p className="text-xs text-muted-foreground">Format: MM-DD (e.g. 01-01 for January 1st)</p>
              {errors.fiscalYearStart && (
                <p className="text-sm text-destructive">{errors.fiscalYearStart.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting} className="gap-2">
        <Save className="h-4 w-4" />
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}

// ─── Tax Settings Tab ─────────────────────────────────────────────────────────

function TaxSettingsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: taxes = [], isLoading } = useQuery({
    queryKey: ['tax-settings'],
    queryFn: () => companyApi.getTaxSettings().then((r) => r.data.data.taxSettings as TaxSetting[]),
  });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.getAll().then((r) => r.data.data.accounts as any[]),
  });

  const assetAccounts = allAccounts.filter((a: any) => a.typeName === 'Asset' && a.isActive);
  const liabilityAccounts = allAccounts.filter((a: any) => a.typeName === 'Liability' && a.isActive);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TaxForm>({
    resolver: zodResolver(taxSchema),
    defaultValues: { appliesTo: 'both', recoverablePercentage: '100' },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companyApi.deleteTaxSetting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-settings'] }),
  });

  const onSubmit = async (form: TaxForm) => {
    try {
      setErrorMsg(null);
      await companyApi.addTaxSetting({
        ...form,
        // Convert percentage inputs to decimal fractions for storage
        taxRate: (parseFloat(form.taxRate) / 100).toFixed(4),
        recoverablePercentage: (parseFloat(form.recoverablePercentage ?? '100') / 100).toFixed(4),
        recoverableAccountId: form.recoverableAccountId ?? null,
        liabilityAccountId: form.liabilityAccountId ?? null,
      });
      qc.invalidateQueries({ queryKey: ['tax-settings'] });
      reset();
      setShowForm(false);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to add tax setting.');
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define tax rates that apply to your invoices, bills, and expenses.
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Tax Rate'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Tax Rate</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {errorMsg && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errorMsg}</div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxName">Name</Label>
                  <Input id="taxName" placeholder="HST Ontario" {...register('taxName')} />
                  {errors.taxName && <p className="text-sm text-destructive">{errors.taxName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Rate (%)</Label>
                  <Input id="taxRate" placeholder="13" {...register('taxRate')} />
                  {errors.taxRate && <p className="text-sm text-destructive">{errors.taxRate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recoverablePercentage">Recoverable (%)</Label>
                  <Input id="recoverablePercentage" placeholder="100" {...register('recoverablePercentage')} />
                  {errors.recoverablePercentage && <p className="text-sm text-destructive">{errors.recoverablePercentage.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appliesTo">Applies To</Label>
                  <select
                    id="appliesTo"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register('appliesTo')}
                  >
                    <option value="both">Both</option>
                    <option value="sales">Sales</option>
                    <option value="purchases">Purchases</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recoverableAccountId">Recoverable Account</Label>
                  <select
                    id="recoverableAccountId"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register('recoverableAccountId')}
                  >
                    <option value="">None</option>
                    {assetAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="liabilityAccountId">Liability Account</Label>
                  <select
                    id="liabilityAccountId"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register('liabilityAccountId')}
                  >
                    <option value="">None</option>
                    {liabilityAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Tax Rate'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : taxes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No tax rates configured yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Rate</th>
                <th className="px-4 py-3 text-left font-medium">Applies To</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {taxes.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.taxName}</td>
                  <td className="px-4 py-3">
                    {(parseFloat(t.taxRate) * 100).toFixed(2)}%
                    {t.recoverablePercentage && parseFloat(t.recoverablePercentage) < 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({(parseFloat(t.recoverablePercentage) * 100).toFixed(0)}% rec.)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{t.appliesTo}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.isActive ? 'default' : 'secondary'}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['company-members'],
    queryFn: () => companyApi.getMembers().then((r) => r.data.data.members as Member[]),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => companyApi.removeMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-members'] }),
  });

  const onInvite = async (form: InviteForm) => {
    try {
      setErrorMsg(null);
      await companyApi.invite(form.email, form.role);
      qc.invalidateQueries({ queryKey: ['company-members'] });
      reset();
      setShowInvite(false);
      setSuccessMsg('Team member added successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to invite member.');
    }
  };

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    accountant: 'bg-blue-100 text-blue-700',
    staff: 'bg-green-100 text-green-700',
    readonly: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage who has access to your company's books.
        </p>
        <Button size="sm" className="gap-2" onClick={() => setShowInvite(!showInvite)}>
          <UserPlus className="h-4 w-4" />
          {showInvite ? 'Cancel' : 'Add Member'}
        </Button>
      </div>

      {successMsg && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      {showInvite && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add Team Member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
              {errorMsg && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errorMsg}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email</Label>
                  <Input id="inviteEmail" type="email" placeholder="colleague@example.com" {...register('email')} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteRole">Role</Label>
                  <select
                    id="inviteRole"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register('role')}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The user must already have a Zurynn account. They will gain access immediately.
              </p>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Member'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-700')}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate(m.userId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
