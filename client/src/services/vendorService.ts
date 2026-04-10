import api from './api';

export interface Vendor {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  balanceOwed: string;
  notes: string | null;
}

export const vendorApi = {
  getAll: () => api.get('/vendors'),
  getOne: (id: number) => api.get(`/vendors/${id}`),
  create: (data: Partial<Vendor>) => api.post('/vendors', data),
  update: (id: number, data: Partial<Vendor>) => api.put(`/vendors/${id}`, data),
  remove: (id: number) => api.delete(`/vendors/${id}`),
};
