import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  Target,
  Flag,
  BookOpen,
  FileText,
  Users,
  LogOut,
  Settings,
  Shield,
  Menu,
  X,
  Megaphone,
  Calendar
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout: React.FC = () => {
  const { userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Anúncios', path: '/announcements', icon: Megaphone },
    { name: 'Objetivos', path: '/objectives', icon: Target },
    { name: 'Metas', path: '/goals', icon: Flag },
    { name: 'Estudo', path: '/study', icon: BookOpen },
    { name: 'Reuniões', path: '/meetings', icon: Calendar },
    { name: 'Relatórios', path: '/reports', icon: FileText },
  ];

  const adminItems = [
    { name: 'Visão Geral', path: '/admin', icon: LayoutDashboard },
    { name: 'Usuários', path: '/admin/users', icon: Users },
    { name: 'Equipes', path: '/admin/teams', icon: Settings },
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-cyan-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">HardSales</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-slate-200 focus:outline-none"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-800 hidden md:block">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">HardSales</h1>
          </div>
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
            <p className="text-sm text-slate-400">Olá,</p>
            <p className="font-medium text-slate-200 truncate">{userData?.name}</p>
            <span className="inline-block mt-2 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {userData?.role === 'admin' ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        </div>

        {/* Mobile User Info */}
        <div className="md:hidden p-4 border-b border-slate-800 mt-16">
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
            <p className="text-sm text-slate-400">Olá,</p>
            <p className="font-medium text-slate-200 truncate">{userData?.name}</p>
            <span className="inline-block mt-2 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {userData?.role === 'admin' ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 shadow-[inset_2px_0_0_0_rgba(34,211,238,1)]"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )}
              >
                <Icon className={cn(
                  "mr-3 h-5 w-5 transition-colors", 
                  isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                )} />
                {item.name}
              </Link>
            );
          })}

          {userData?.role === 'admin' && (
            <>
              <div className="pt-6 mt-6 border-t border-slate-800/50">
                <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Administração
                </p>
                <div className="space-y-1.5">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={closeMobileMenu}
                        className={cn(
                          "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group",
                          isActive
                            ? "bg-purple-500/10 text-purple-400 shadow-[inset_2px_0_0_0_rgba(168,85,247,1)]"
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        )}
                      >
                        <Icon className={cn(
                          "mr-3 h-5 w-5 transition-colors", 
                          isActive ? "text-purple-400" : "text-slate-500 group-hover:text-slate-300"
                        )} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors group"
          >
            <LogOut className="mr-3 h-5 w-5 text-red-500/70 group-hover:text-red-400 transition-colors" />
            Sair do Sistema
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-[#0B1121] pt-16 md:pt-0">
        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
