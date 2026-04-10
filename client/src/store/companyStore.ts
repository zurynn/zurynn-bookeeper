import { create } from 'zustand';

interface Company {
  id: number;
  name: string;
  currency: string;
  fiscalYearStart: string;
}

interface CompanyState {
  company: Company | null;
  companyId: number | null;
  setCompany: (company: Company) => void;
  clearCompany: () => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  companyId: null,
  setCompany: (company) => set({ company, companyId: company.id }),
  clearCompany: () => set({ company: null, companyId: null }),
}));
