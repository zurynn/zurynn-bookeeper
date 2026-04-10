import api from './api';

export interface ExpenseLine {
  id?: number;
  expenseAccountId: number;
  expenseAccountName?: string;
  description: string;
  amount: string;
  taxCodeId?: number | null;
  taxCodeName?: string | null;
  taxAmount: string;
}

export interface Expense {
  id: number;
  expenseNumber: string;
  vendorId: number | null;
  vendorName: string | null;
  paymentAccountId: number;
  paymentAccountName: string;
  date: string;
  description: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  journalEntryId: number | null;
  postedAt: string | null;
  voidedAt: string | null;
  notes: string | null;
  lines?: ExpenseLine[];
}

export interface ExpenseAttachment {
  id: number;
  expenseId: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export const expenseApi = {
  getAll: (page = 1) => api.get('/expenses', { params: { page } }),
  getOne: (id: number) => api.get(`/expenses/${id}`),
  create: (data: {
    vendorId?: number | null;
    paymentAccountId: number;
    date: string;
    description: string;
    notes?: string;
    lines: ExpenseLine[];
  }) => api.post('/expenses', data),
  update: (id: number, data: any) => api.put(`/expenses/${id}`, data),
  post: (id: number) => api.post(`/expenses/${id}/post`),
  void: (id: number) => api.post(`/expenses/${id}/void`),
  remove: (id: number) => api.delete(`/expenses/${id}`),
};

export const expenseAttachmentApi = {
  list: (expenseId: number) => api.get(`/expenses/${expenseId}/attachments`),
  upload: (expenseId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/expenses/${expenseId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (expenseId: number, attachmentId: number) =>
    api.delete(`/expenses/${expenseId}/attachments/${attachmentId}`),
};
