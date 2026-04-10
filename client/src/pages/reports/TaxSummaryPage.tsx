import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reportApi, type TaxSummaryData } from '@/services/reportService';

const today = new Date().toISOString().slice(0, 10);
const yearStart = today.slice(0, 4) + '-01-01';

function fmt(val: string) {
  return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function fmtPeriod(period: string) {
  // 'YYYY-MM' → 'Jan 2024'
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function TaxSummaryPage() {
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [runParams, setRunParams] = useState({ startDate: yearStart, endDate: today });

  const { data, isLoading, error } = useQuery<TaxSummaryData>({
    queryKey: ['taxSummary', runParams.startDate, runParams.endDate],
    queryFn: () => reportApi.getTaxSummary(runParams.startDate, runParams.endDate).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Tax Summary</h1>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" className="w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" className="w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button onClick={() => setRunParams({ startDate, endDate })}>Run Report</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Calculating…</p>}
      {error && <p className="text-sm text-destructive">{(error as any).response?.data?.error || 'Failed to load report.'}</p>}

      {data && data.periods.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No taxable invoices (sent, partial, or paid with tax &gt; $0) found for this period.
        </p>
      )}

      {data && data.periods.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {data.startDate} — {data.endDate}
          </p>

          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                  <th className="px-4 py-3 text-right font-medium">Tax Collected</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.periods.map((p) => (
                  <tr key={p.period} className="hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{fmtPeriod(p.period)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{p.invoiceCount}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(p.subtotal)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-orange-600">
                      {fmt(p.taxAmount)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(p.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-foreground bg-muted/30">
                <tr>
                  <td className="px-4 py-2 font-bold">Total</td>
                  <td className="px-4 py-2 text-right font-semibold text-muted-foreground">
                    {data.periods.reduce((s, p) => s + p.invoiceCount, 0)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{fmt(data.totalSubtotal)}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-orange-600">
                    {fmt(data.totalTaxAmount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{fmt(data.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-lg border bg-orange-50 border-orange-200 p-4">
            <p className="text-sm font-semibold text-orange-800">Tax Liability Summary</p>
            <p className="text-2xl font-bold font-mono text-orange-700 mt-1">{fmt(data.totalTaxAmount)}</p>
            <p className="text-xs text-orange-600 mt-1">Total tax collected on invoices in this period</p>
          </div>
        </div>
      )}
    </div>
  );
}
