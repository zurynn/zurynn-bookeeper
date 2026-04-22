import api from './api';

export interface Transaction {
  id: number;
  companyId: number;
  type: 'income' | 'expense';
  date: string;
  description: string;
  amount: string;
  category: string;
  accountCode: string;
  journalEntryId: number | null;
  createdBy: number;
  createdAt: string;
}

export interface TransactionPayload {
  type: 'income' | 'expense';
  date: string;
  description: string;
  amount: string;
  category: string;
}

export const transactionService = {
  list: (page = 1) =>
    api.get('/transactions', { params: { page } }).then((r) => r.data.data as {
      transactions: Transaction[];
      total: number;
      page: number;
      limit: number;
    }),

  create: (payload: TransactionPayload) =>
    api.post('/transactions', payload).then((r) => r.data.data.transaction as Transaction),

  delete: (id: number) =>
    api.delete(`/transactions/${id}`),

  categories: () =>
    api.get('/transactions/categories').then((r) => r.data.data as {
      income: string[];
      expense: string[];
    }),
};
