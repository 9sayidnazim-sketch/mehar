import { db } from '@/api/base44Client';
import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useTheme } from '@/lib/theme';
import {
  LayoutDashboard, Users, ClipboardList, Scissors, Settings as SettingsIcon,
  Sun, Moon, LogOut, Menu, X, Ruler, Bell, Search, CreditCard, ShoppingBag,
  Globe, BookOpen, ShieldCheck, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/tailors', label: 'Workshop', icon: Scissors },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/sales', label: 'Sales', icon: ShoppingBag },
  { to: '/online-orders', label: 'Online Orders', icon: Globe },
  { to: '/accounts', label: 'Accounts', icon: BookOpen },
  { to: '/paywall', label: 'License & Paywall', icon: ShieldCheck, badge: 'PRO' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 text-foreground select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4.5 border-b border-border/70 bg-white dark:bg-slate-900 pr-12">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-violet-500/30 overflow-hidden shrink-0">
          <img src="/octapus-logo.svg" alt="OCTAPUS" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-base font-extrabold tracking-tight text-foreground">OCTAPUS</p>
            <span className="rounded-md bg-violet-600/10 border border-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400">THREDO</span>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground truncate">Tailoring & Retail Suite</p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1.5 px-3 py-3.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-semibold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-foreground font-medium'
              )
            }
          >
            {({ isActive }) => (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-primary-foreground' : 'text-slate-500 dark:text-slate-400 group-hover:text-foreground'
                  )}
                  style={{ width: '1.125rem', height: '1.125rem' }}
                />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                  )}>
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <span className="ml-auto h-2 w-2 rounded-full bg-white shadow-sm shrink-0" />
                ) : null}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Paywall & License Footer Card */}
      <div className="border-t border-border/70 p-3.5 bg-white dark:bg-slate-900">
        <NavLink
          to="/paywall"
          onClick={onNavigate}
          className="group block rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-purple-500/10 p-3 hover:border-violet-500/40 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">OCTAPUS Paywall</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Pro Plans
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Redeem Pass & Pricing</span>
            <span className="font-semibold text-primary group-hover:translate-x-0.5 transition-transform">View →</span>
          </p>
        </NavLink>

        <div className="mt-2.5 flex items-center justify-between px-1 text-[10px] font-medium text-muted-foreground">
          <span>OCTAPUS POS <strong className="font-semibold text-foreground">v2.5 Live</strong></span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Online
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await db.auth.logout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white dark:bg-slate-900 text-card-foreground shadow-sm lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile slide drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-all duration-300",
          mobileOpen ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
        )}
      >
        {/* Solid dark backdrop with blur */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />

        {/* Slide-in sidebar panel - 100% OPAQUE SOLID BG */}
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-80 max-w-[85vw] border-r border-border/80 bg-white dark:bg-slate-900 text-foreground shadow-2xl transition-transform duration-300 ease-out z-50 flex flex-col overflow-hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="absolute right-3 top-3.5 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-20"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open mobile navigation"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search orders, customers..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    navigate(`/orders?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
                  }
                }}
                className="h-9 w-64 rounded-lg border border-input bg-muted/40 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-card transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-lg" title="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5" style={{ width: '1.125rem', height: '1.125rem' }} /> : <Moon className="h-4.5 w-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />}
            </Button>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg" title="Notifications">
              <Bell className="h-4.5 w-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-600" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive" title="Sign out">
              <LogOut className="h-4.5 w-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}