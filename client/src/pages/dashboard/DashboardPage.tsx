import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  DollarSign, TrendingUp, TrendingDown, FileText,
  Receipt, Landmark, CreditCard, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/services/api';

interface DashboardData {
  period: { monthStart: string; monthEnd: string };
  kpis: {
    monthRevenue: string;
    monthExpenses: string;
    monthNetIncome: string;
    cashBalance: string;
    totalAR: string;
    totalAP: string;
    openInvoiceCount: number;
    openInvoiceBalance: string;
    openBillCount: number;
    openBillBalance: string;
  };
  recentInvoices: {
    id: number;
    invoiceNumber: string;
    customerName: string;
    date: string;
    total: string;
    amountPaid: string;
    status: string;
  }[];
  recentBills: {
    id: number;
    billNumber: string;
    vendorName: string;
    date: string;
    total: string;
    amountPaid: string;
    status: string;
  }[];
}

function fmt(val: string) {
  const n = parseFloat(val);
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function fmtMonth(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  approved: 'bg-blue-100 text-blue-700',
  void: 'bg-red-100 text-red-600',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  const kpis = data?.kpis;
  const monthLabel = data ? fmtMonth(data.period.monthStart) : '';
  const netPositive = kpis ? parseFloat(kpis.monthNetIncome) >= 0 : true;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {monthLabel && (
          <span className="text-sm text-muted-foreground">{monthLabel}</span>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Revenue"
          value={fmt(kpis?.monthRevenue ?? '0')}
          sub="This month"
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          valueClass="text-green-700"
        />
        <KpiCard
          title="Expenses"
          value={fmt(kpis?.monthExpenses ?? '0')}
          sub="This month"
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          valueClass="text-red-600"
        />
        <KpiCard
          title="Net Income"
          value={fmt(kpis?.monthNetIncome ?? '0')}
          sub="This month"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          valueClass={netPositive ? 'text-green-700' : 'text-red-600'}
        />
        <KpiCard
          title="Cash Balance"
          value={fmt(kpis?.cashBalance ?? '0')}
          sub="All bank accounts"
          icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
          valueClass={parseFloat(kpis?.cashBalance ?? '0') >= 0 ? 'text-green-700' : 'text-red-600'}
        />
        <KpiCard
          title="Receivable"
          value={fmt(kpis?.totalAR ?? '0')}
          sub={`${kpis?.openInvoiceCount ?? 0} open invoice${kpis?.openInvoiceCount !== 1 ? 's' : ''}`}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          valueClass={parseFloat(kpis?.totalAR ?? '0') > 0 ? 'text-orange-600' : ''}
        />
        <KpiCard
          title="Payable"
          value={fmt(kpis?.totalAP ?? '0')}
          sub={`${kpis?.openBillCount ?? 0} open bill${kpis?.openBillCount !== 1 ? 's' : ''}`}
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          valueClass={parseFloat(kpis?.totalAP ?? '0') > 0 ? 'text-red-600' : ''}
        />
      </div>

      {/* ── Recent Activity ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <Link
                to="/invoices"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!data?.recentInvoices?.length ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {data.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{inv.customerName}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{inv.date}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium">
                        {fmt(inv.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[inv.status] ?? ''}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Recent Bills */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Bills</CardTitle>
              <Link
                to="/bills"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!data?.recentBills?.length ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No bills yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {data.recentBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{bill.billNumber}</p>
                        <p className="text-xs text-muted-foreground">{bill.vendorName}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{bill.date}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium">
                        {fmt(bill.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[bill.status] ?? ''}`}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Links ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/invoices', label: 'New Invoice', icon: <FileText className="h-4 w-4" /> },
          { to: '/bills', label: 'New Bill', icon: <CreditCard className="h-4 w-4" /> },
          { to: '/reports/profit-loss', label: 'P&L Report', icon: <TrendingUp className="h-4 w-4" /> },
          { to: '/banking', label: 'Banking', icon: <Landmark className="h-4 w-4" /> },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
          >
            {item.icon}
            {item.label}
            <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  title, value, sub, icon, valueClass = '',
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-xl font-bold font-mono ${valueClass}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
