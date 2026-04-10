import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, FileText, Users, Receipt,
  Store, CreditCard, Building2, BarChart3, Settings,
  TrendingUp, Wallet, ArrowLeftRight, ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: BookOpen, label: 'Chart of Accounts' },
  { to: '/journal', icon: FileText, label: 'General Ledger' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/vendors', icon: Store, label: 'Vendors' },
  { to: '/bills', icon: CreditCard, label: 'Bills' },
  { to: '/expenses', icon: ShoppingBag, label: 'Expenses' },
  { to: '/banking', icon: Building2, label: 'Banking' },
];

const reportItems = [
  { to: '/reports/profit-loss', icon: TrendingUp, label: 'Profit & Loss' },
  { to: '/reports/balance-sheet', icon: BarChart3, label: 'Balance Sheet' },
  { to: '/reports/cash-flow', icon: Wallet, label: 'Cash Flow' },
  { to: '/reports/tax-summary', icon: ArrowLeftRight, label: 'Tax Summary' },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">Zurynn</h1>
        <p className="text-xs text-slate-400 mt-1">Book Keeper</p>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
        
        <div className="pt-4">
          <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports</p>
          {reportItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      
      <div className="p-4 border-t border-slate-700">
        <NavLink
          to="/settings/company"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </div>
  );
}
