import api from './api';

export interface PnLLine {
  accountId: number;
  code: string;
  name: string;
  net: string;
}

export interface PnLData {
  startDate: string;
  endDate: string;
  revenue: PnLLine[];
  expenses: PnLLine[];
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
}

export interface BalanceLine {
  accountId: number;
  code: string;
  name: string;
  balance: string;
}

export interface BalanceSheetData {
  asOfDate: string;
  assets: BalanceLine[];
  liabilities: BalanceLine[];
  equity: BalanceLine[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
}

export interface CashFlowData {
  startDate: string;
  endDate: string;
  cashAccounts: string[];
  beginningCash: string;
  periodDebits: string;
  periodCredits: string;
  netChange: string;
  endingCash: string;
  netIncome: string;
}

export interface TaxPeriod {
  period: string;
  invoiceCount: number;
  subtotal: string;
  taxAmount: string;
  total: string;
}

export interface TaxSummaryData {
  startDate: string;
  endDate: string;
  periods: TaxPeriod[];
  totalSubtotal: string;
  totalTaxAmount: string;
  totalAmount: string;
}

export const reportApi = {
  getPnL: (startDate: string, endDate: string) =>
    api.get('/reports/pnl', { params: { startDate, endDate } }),
  getBalanceSheet: (asOfDate: string) =>
    api.get('/reports/balance-sheet', { params: { asOfDate } }),
  getCashFlow: (startDate: string, endDate: string) =>
    api.get('/reports/cash-flow', { params: { startDate, endDate } }),
  getTaxSummary: (startDate: string, endDate: string) =>
    api.get('/reports/tax-summary', { params: { startDate, endDate } }),
};
