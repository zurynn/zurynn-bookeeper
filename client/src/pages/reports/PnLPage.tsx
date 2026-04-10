import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reportApi, type PnLData } from '@/services/reportService';

const today = new Date().toISOString().slice(0, 10);
const yearStart = today.slice(0, 4) + '-01-01';

function fmt(val: string) {
  const n = parseFloat(val);
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function PnLPage() {
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [runParams, setRunParams] = useState({ startDate: yearStart, endDate: today });

  const { data, isLoading, error } = useQuery<PnLData>({
    queryKey: ['pnl', runParams.startDate, runParams.endDate],
    queryFn: () => reportApi.getPnL(runParams.startDate, runParams.endDate).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Profit &amp; Loss</h1>

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

      {data && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
            {data.startDate} — {data.endDate}
          </p>

          <ReportSection title="Revenue" lines={data.revenue} total={data.totalRevenue} totalLabel="Total Revenue" totalClass="text-green-700" />
          <div className="h-2" />
          <ReportSection title="Expenses" lines={data.expenses} total={data.totalExpenses} totalLabel="Total Expenses" totalClass="text-red-600" />

          <div className="border-t-2 border-foreground mt-3 pt-3 flex justify-between font-bold text-base">
            <span>Net Income</span>
            <span className={`font-mono ${parseFloat(data.netIncome) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmt(data.netIncome)}
            </span>
          </div>
        </div>
      )}

      {data && data.revenue.length === 0 && data.expenses.length === 0 && (
        <p className="text-sm text-muted-foreground">No posted journal entries found for this period.</p>
      )}
    </div>
  );
}

function ReportSection({
  title, lines, total, totalLabel, totalClass,
}: {
  title: string;
  lines: { accountId: number; code: string; name: string; net: string }[];
  total: string;
  totalLabel: string;
  totalClass: string;
}) {
  return (
    <div>
      <div className="bg-muted/50 px-3 py-1.5 rounded-t text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="border border-t-0 rounded-b divide-y">
        {lines.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground italic">No activity</div>
        ) : (
          lines.map((line) => (
            <div key={line.accountId} className="flex justify-between px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">
                <span className="font-mono mr-2 text-xs">{line.code}</span>{line.name}
              </span>
              <span className="font-mono">{fmt(line.net)}</span>
            </div>
          ))
        )}
        <div className={`flex justify-between px-3 py-2 text-sm font-semibold border-t ${totalClass}`}>
          <span>{totalLabel}</span>
          <span className="font-mono">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
