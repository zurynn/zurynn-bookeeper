import api from './api';

export interface JournalLine {
  id?: number;
  accountId: number;
  accountCode?: string;
  accountName?: string;
  debit: string;
  credit: string;
  memo?: string;
}

export interface JournalEntry {
  id: number;
  date: string;
  description: string;
  reference: string | null;
  status: string;
  reversalOfId: number | null;
  totalDebits: string;
  createdAt: string;
}

export interface JournalEntryDetail extends JournalEntry {
  lines: JournalLine[];
}

export const journalApi = {
  getAll: (page = 1) => api.get('/journal', { params: { page } }),
  getOne: (id: number) => api.get(`/journal/${id}`),
  create: (data: { date: string; description: string; reference?: string; lines: JournalLine[] }) =>
    api.post('/journal', data),
  update: (id: number, data: { date?: string; description?: string; reference?: string; lines?: JournalLine[] }) =>
    api.put(`/journal/${id}`, data),
  post: (id: number) => api.post(`/journal/${id}/post`),
  reverse: (id: number, date: string) => api.post(`/journal/${id}/reverse`, { date }),
  remove: (id: number) => api.delete(`/journal/${id}`),
};
