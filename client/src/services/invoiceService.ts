import api from './api';

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  amount?: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  terms: string | null;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface Payment {
  id: number;
  date: string;
  amount: string;
  method: string;
  reference: string | null;
  notes: string | null;
}

export const invoiceApi = {
  getAll: (page = 1) => api.get('/invoices', { params: { page } }),
  getOne: (id: number) => api.get(`/invoices/${id}`),
  create: (data: {
    customerId: number; date: string; dueDate: string;
    notes?: string; terms?: string; items: InvoiceItem[];
  }) => api.post('/invoices', data),
  update: (id: number, data: any) => api.put(`/invoices/${id}`, data),
  send: (id: number) => api.post(`/invoices/${id}/send`),
  recordPayment: (id: number, data: {
    date: string; amount: string; method: string; reference?: string; notes?: string;
  }) => api.post(`/invoices/${id}/payments`, data),
  remove: (id: number) => api.delete(`/invoices/${id}`),
};
