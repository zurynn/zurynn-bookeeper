import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { companyApi } from '@/services/companyService';
import { useCompanyStore } from '@/store/companyStore';
import { useAuthStore } from '@/store/authStore';

const schema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  industry: z.string().optional(),
  currency: z.string().length(3, 'Must be a 3-letter code').default('USD'),
  fiscalYearStart: z
    .string()
    .regex(/^\d{2}-\d{2}$/, 'Format: MM-DD')
    .default('01-01'),
});

type FormData = z.infer<typeof schema>;

const INDUSTRIES = [
  'Accounting / Finance',
  'Agriculture',
  'Construction',
  'Education',
  'Healthcare',
  'Hospitality',
  'Legal',
  'Manufacturing',
  'Non-Profit',
  'Real Estate',
  'Retail',
  'Technology',
  'Transportation',
  'Other',
];

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'CAD', label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', label: 'Australian Dollar (AUD)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
];

export default function CreateCompanyPage() {
  const navigate = useNavigate();
  const { setCompany } = useCompanyStore();
  const { setAccessToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'USD', fiscalYearStart: '01-01' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      const res = await companyApi.create(data);
      const { company, accessToken } = res.data.data;
      setCompany(company);
      setAccessToken(accessToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create company. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <Building2 className="h-6 w-6 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Set up your company</CardTitle>
          <CardDescription>
            Tell us a bit about your business to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" placeholder="Acme Corp" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('industry')}
              >
                <option value="">Select an industry...</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('currency')}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                <Input
                  id="fiscalYearStart"
                  placeholder="01-01"
                  {...register('fiscalYearStart')}
                />
                <p className="text-xs text-muted-foreground">Format: MM-DD</p>
                {errors.fiscalYearStart && (
                  <p className="text-sm text-destructive">{errors.fiscalYearStart.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Company'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
