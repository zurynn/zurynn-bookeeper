import api from './api';

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  currency: string;
  balanceDue: string;
  notes: string | null;
}

export const customerApi = {
  getAll: () => api.get('/customers'),
  getOne: (id: number) => api.get(`/customers/${id}`),
  create: (data: Partial<Customer>) => api.post('/customers', data),
  update: (id: number, data: Partial<Customer>) => api.put(`/customers/${id}`, data),
  remove: (id: number) => api.delete(`/customers/${id}`),
};
