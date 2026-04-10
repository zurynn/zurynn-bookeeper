import { useAuthStore } from '@/store/authStore';
import { useCompanyStore } from '@/store/companyStore';
import { Button } from '@/components/ui/button';
import { LogOut, User, Building2 } from 'lucide-react';
import api from '@/services/api';

export default function Header() {
  const { user, clearAuth } = useAuthStore();
  const { company, clearCompany } = useCompanyStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    clearAuth();
    clearCompany();
  };

  return (
    <header className="h-14 border-b bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {company && (
          <>
            <Building2 className="h-4 w-4" />
            <span className="font-medium text-foreground">{company.name}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{user?.firstName} {user?.lastName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
