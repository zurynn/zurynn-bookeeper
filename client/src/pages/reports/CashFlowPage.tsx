import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reportApi, type CashFlowData } from '@/services/reportService';

const today = new Date().toISOString().slice(0, 10);
const yearStart = today.slice(0, 4) + '-01-01';

function fmt(val: string) {
  const n = parseFloat(val);
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function Row({ label, value, bold, indent, className = '' }: { label: string; value: string; bold?: boolean; indent?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between px-3 py-1.5 text-sm ${bold ? 'font-semibold' : ''} ${indent ? 'pl-8' : ''} ${className}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [runParams, setRunParams] = useState({ startDate: yearStart, endDate: today });

  const { data, isLoading, error } = useQuery<CashFlowData>({
    queryKey: ['cashFlow', runParams.startDate, runParams.endDate],
    queryFn: () => reportApi.getCashFlow(runParams.startDate, runParams.endDate).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Cash Flow</h1>

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
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {data.startDate} — {data.endDate}
          </p>

          {data.cashAccounts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Cash accounts tracked: {data.cashAccounts.join(', ')}
            </p>
          )}

          {/* Operating Activities */}
          <div>
            <div className="bg-muted/50 px-3 py-1.5 rounded-t text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Operating Activities
            </div>
            <div className="border border-t-0 rounded-b divide-y">
              <Row label="Net Income" value={data.netIncome} indent />
              <Row label="Cash Received (debits to cash)" value={data.periodDebits} indent />
              <Row label="Cash Paid (credits to cash)" value={`-${data.periodCredits}`} indent />
              <Row
                label="Net Cash from Operations"
                value={data.netChange}
                bold
                className={parseFloat(data.netChange) >= 0 ? 'text-green-700' : 'text-red-600'}
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-muted/50 px-3 py-1.5 rounded-t text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cash Position Summary
            </div>
            <div className="border border-t-0 rounded-b divide-y">
              <Row label="Beginning Cash Balance" value={data.beginningCash} />
              <Row label="Net Change in Cash" value={data.netChange} />
              <Row
                label="Ending Cash Balance"
                value={data.endingCash}
                bold
                className={parseFloat(data.endingCash) >= 0 ? 'text-green-700' : 'text-red-600'}
              />
            </div>
          </div>

          {data.cashAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No cash accounts found (accounts with code starting with "10"). Add a Cash account under Chart of Accounts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
