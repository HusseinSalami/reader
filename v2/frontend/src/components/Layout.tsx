import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  FileText,
  Search,
  Download,
  LogOut,
  ScanLine,
} from 'lucide-react';
import { logout, getTenant } from '../services/api';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/exports', label: 'Exports', icon: Download },
];

export default function Layout() {
  const tenant = getTenant();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Reader</h1>
              <p className="text-xs text-slate-400">Document Scanner</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{tenant?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{tenant?.email || ''}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
