import api from './api';

export interface Company {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  industry?: string;
  currency: string;
  fiscalYearStart: string;
  logoUrl?: string;
}

export interface TaxSetting {
  id: number;
  companyId: number;
  taxName: string;
  taxRate: string;
  recoverablePercentage: string;
  recoverableAccountId: number | null;
  liabilityAccountId: number | null;
  appliesTo: string;
  isActive: boolean;
}

export interface Member {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export const companyApi = {
  create: (data: {
    name: string;
    currency?: string;
    fiscalYearStart?: string;
    industry?: string;
  }) => api.post('/companies', data),

  getMe: () => api.get('/companies/me'),

  updateMe: (data: Partial<Company>) => api.put('/companies/me', data),

  getMembers: () => api.get('/companies/me/members'),

  invite: (email: string, role: string) =>
    api.post('/companies/me/invite', { email, role }),

  removeMember: (userId: number) =>
    api.delete(`/companies/me/members/${userId}`),

  getTaxSettings: () => api.get('/companies/me/tax-settings'),

  addTaxSetting: (data: {
    taxName: string;
    taxRate: string;
    recoverablePercentage?: string;
    recoverableAccountId?: number | null;
    liabilityAccountId?: number | null;
    appliesTo: string;
  }) => api.post('/companies/me/tax-settings', data),

  updateTaxSetting: (id: number, data: Partial<{
    taxName: string;
    taxRate: string;
    recoverablePercentage: string;
    recoverableAccountId: number | null;
    liabilityAccountId: number | null;
    appliesTo: string;
    isActive: boolean;
  }>) => api.put(`/companies/me/tax-settings/${id}`, data),

  deleteTaxSetting: (id: number) =>
    api.delete(`/companies/me/tax-settings/${id}`),
};
