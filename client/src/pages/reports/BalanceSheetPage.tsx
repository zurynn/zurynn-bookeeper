import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reportApi, type BalanceSheetData } from '@/services/reportService';

const today = new Date().toISOString().slice(0, 10);

function fmt(val: string) {
  const n = parseFloat(val);
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(today);
  const [runDate, setRunDate] = useState(today);

  const { data, isLoading, error } = useQuery<BalanceSheetData>({
    queryKey: ['balanceSheet', runDate],
    queryFn: () => reportApi.getBalanceSheet(runDate).then((r) => r.data.data),
  });

  const balanced = data
    ? Math.abs(parseFloat(data.totalAssets) - parseFloat(data.totalLiabilitiesAndEquity)) < 0.02
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Balance Sheet</h1>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <Label>As of Date</Label>
          <Input type="date" className="w-40" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        <Button onClick={() => setRunDate(asOfDate)}>Run Report</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Calculating…</p>}
      {error && <p className="text-sm text-destructive">{(error as any).response?.data?.error || 'Failed to load report.'}</p>}

      {data && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            As of {data.asOfDate}
          </p>

          {/* Assets */}
          <BSSection title="Assets" lines={data.assets} total={data.totalAssets} totalLabel="Total Assets" totalClass="text-green-700" />

          {/* Liabilities */}
          <BSSection title="Liabilities" lines={data.liabilities} total={data.totalLiabilities} totalLabel="Total Liabilities" totalClass="text-red-600" />

          {/* Equity */}
          <BSSection title="Equity" lines={data.equity} total={data.totalEquity} totalLabel="Total Equity" totalClass="text-blue-700" />

          {/* Summary */}
          <div className="border-t-2 border-foreground pt-3 space-y-1">
            <div className="flex justify-between text-sm font-semibold text-red-600">
              <span>Total Liabilities &amp; Equity</span>
              <span className="font-mono">{fmt(data.totalLiabilitiesAndEquity)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-green-700">
              <span>Total Assets</span>
              <span className="font-mono">{fmt(data.totalAssets)}</span>
            </div>
            {balanced !== null && (
              <p className={`text-xs font-medium ${balanced ? 'text-green-600' : 'text-orange-600'}`}>
                {balanced ? '✓ Balance sheet is balanced' : '⚠ Balance sheet is out of balance — check for unposted entries'}
              </p>
            )}
          </div>
        </div>
      )}

      {data && data.assets.length === 0 && data.liabilities.length === 0 && data.equity.length === 0 && (
        <p className="text-sm text-muted-foreground">No posted journal entries found as of this date.</p>
      )}
    </div>
  );
}

function BSSection({
  title, lines, total, totalLabel, totalClass,
}: {
  title: string;
  lines: { accountId: number; code: string; name: string; balance: string }[];
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
          <div className="px-3 py-2 text-sm text-muted-foreground italic">No balances</div>
        ) : (
          lines.map((line) => (
            <div key={`${line.accountId}-${line.code}`} className="flex justify-between px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">
                {line.code !== 'RE' && <span className="font-mono mr-2 text-xs">{line.code}</span>}
                {line.name}
              </span>
              <span className="font-mono">{fmt(line.balance)}</span>
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
