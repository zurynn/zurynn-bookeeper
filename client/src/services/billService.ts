import api from './api';

export interface BillItem {
  id?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  amount?: string;
}

export interface Bill {
  id: number;
  billNumber: string;
  vendorId: number;
  vendorName: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  items?: BillItem[];
  payments?: BillPayment[];
}

export interface BillPayment {
  id: number;
  date: string;
  amount: string;
  method: string;
  reference: string | null;
}

export const billApi = {
  getAll: (page = 1) => api.get('/bills', { params: { page } }),
  getOne: (id: number) => api.get(`/bills/${id}`),
  create: (data: {
    vendorId: number; date: string; dueDate: string; notes?: string; items: BillItem[];
  }) => api.post('/bills', data),
  update: (id: number, data: any) => api.put(`/bills/${id}`, data),
  approve: (id: number) => api.post(`/bills/${id}/approve`),
  recordPayment: (id: number, data: {
    date: string; amount: string; method: string; reference?: string;
  }) => api.post(`/bills/${id}/payments`, data),
  remove: (id: number) => api.delete(`/bills/${id}`),
};

export interface BillAttachment {
  id: number;
  billId: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export const attachmentApi = {
  list: (billId: number) => api.get(`/bills/${billId}/attachments`),
  upload: (billId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/bills/${billId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (billId: number, attachmentId: number) =>
    api.delete(`/bills/${billId}/attachments/${attachmentId}`),
};
