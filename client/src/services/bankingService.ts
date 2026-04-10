import api from './api';

export interface BankAccount {
  id: number;
  companyId: number;
  accountId: number | null;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  currentBalance: string;
  isActive: boolean;
}

export interface BankTransaction {
  id: number;
  bankAccountId: number;
  date: string;
  description: string;
  amount: string;
  type: 'debit' | 'credit';
  reconciled: boolean;
  matchedJournalEntryId: number | null;
}

export interface Reconciliation {
  id: number;
  bankAccountId: number;
  statementDate: string;
  statementBalance: string;
  reconciledBalance: string;
  status: 'open' | 'closed';
  completedAt: string | null;
}

export interface TransactionRow {
  date: string;
  description: string;
  amount: string;
  type: 'debit' | 'credit';
}

export const bankApi = {
  // Bank accounts
  getAll: () => api.get('/bank-accounts'),
  create: (data: {
    name: string;
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    openingBalance?: string;
  }) => api.post('/bank-accounts', data),
  update: (
    id: number,
    data: Partial<{ name: string; bankName: string; accountNumber: string; routingNumber: string }>,
  ) => api.put(`/bank-accounts/${id}`, data),
  remove: (id: number) => api.delete(`/bank-accounts/${id}`),

  // Transactions
  getTransactions: (id: number, page = 1, filter = 'all') =>
    api.get(`/bank-accounts/${id}/transactions`, { params: { page, filter } }),
  addTransaction: (id: number, data: TransactionRow) =>
    api.post(`/bank-accounts/${id}/transactions`, data),
  importTransactions: (id: number, transactions: TransactionRow[]) =>
    api.post(`/bank-accounts/${id}/transactions/import`, { transactions }),
  matchTx: (bankId: number, txId: number, journalEntryId: number) =>
    api.put(`/bank-accounts/${bankId}/transactions/${txId}/match`, { journalEntryId }),
  unmatchTx: (bankId: number, txId: number) =>
    api.delete(`/bank-accounts/${bankId}/transactions/${txId}/match`),

  // Reconciliation
  getReconciliations: (id: number) => api.get(`/bank-accounts/${id}/reconciliations`),
  getOpenRecon: (id: number) => api.get(`/bank-accounts/${id}/reconciliations/open`),
  startRecon: (id: number, data: { statementDate: string; statementBalance: string }) =>
    api.post(`/bank-accounts/${id}/reconciliations`, data),
  closeRecon: (bankId: number, reconId: number, markedTxIds: number[]) =>
    api.post(`/bank-accounts/${bankId}/reconciliations/${reconId}/close`, { markedTxIds }),
};
