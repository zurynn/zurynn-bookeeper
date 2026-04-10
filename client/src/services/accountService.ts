import api from './api';

export interface AccountType {
  id: number;
  name: string;
  normalBalance: string;
}

export interface Account {
  id: number;
  companyId: number;
  accountTypeId: number;
  typeName: string;
  normalBalance: string;
  parentId: number | null;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  balance: string;
}

export const accountApi = {
  getTypes: () => api.get('/accounts/types'),
  getAll: () => api.get('/accounts'),
  getOne: (id: number) => api.get(`/accounts/${id}`),
  create: (data: { accountTypeId: number; code: string; name: string; description?: string; parentId?: number }) =>
    api.post('/accounts', data),
  update: (id: number, data: Partial<{ code: string; name: string; description: string; isActive: boolean }>) =>
    api.put(`/accounts/${id}`, data),
  remove: (id: number) => api.delete(`/accounts/${id}`),
};
