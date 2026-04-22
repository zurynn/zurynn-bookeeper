import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign, TrendingUp, TrendingDown, Landmark, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/services/api';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  date: string;
  description: string;
  amount: string;
  category: string;
}

interface DashboardData {
  period: { monthStart: string; monthEnd: string };
  kpis: {
    monthIncome: string;
    monthExpenses: string;
    monthNetIncome: string;
    cashBalance: string;
  };
  recentTransactions: Transaction[];
}

function fmt(val: string) {
  const n = parseFloat(val);
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function fmtMonth(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

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
  const netPositive = parseFloat(kpis?.monthNetIncome ?? '0') >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {monthLabel && <span className="text-sm text-muted-foreground">{monthLabel}</span>}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Income"
          value={fmt(kpis?.monthIncome ?? '0')}
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
          sub="Current total"
          icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
          valueClass={parseFloat(kpis?.cashBalance ?? '0') >= 0 ? 'text-green-700' : 'text-red-600'}
        />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link
              to="/transactions"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!data?.recentTransactions?.length ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {data.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{tx.date}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`font-mono font-semibold ${tx.type === 'income' ? 'text-green-700' : 'text-red-600'}`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}{fmt(tx.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { to: '/transactions', label: 'Add Transaction', icon: <Plus className="h-4 w-4" /> },
          { to: '/reports/profit-loss', label: 'Profit & Loss', icon: <TrendingUp className="h-4 w-4" /> },
          { to: '/reports/balance-sheet', label: 'Balance Sheet', icon: <Landmark className="h-4 w-4" /> },
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
