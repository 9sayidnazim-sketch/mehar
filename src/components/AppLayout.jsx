import { db } from '@/api/base44Client';
import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useTheme } from '@/lib/theme';
import {
  LayoutDashboard, Users, ClipboardList, Scissors, Settings as SettingsIcon,
  Sun, Moon, LogOut, Menu, X, Ruler, Bell, Search, CreditCard, ShoppingBag,
  Globe, BookOpen
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
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-violet-500/25 overflow-hidden">
          <img src="/octapus-logo.svg" alt="OCTAPUS" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-base font-extrabold tracking-tight text-foreground">OCTAPUS</p>
            <span className="rounded-full bg-violet-100 px-1.5 py-0.2 text-[9px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">THREDO</span>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground truncate">Tailoring & Retail Suite</p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-semibold'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  style={{ width: '1.125rem', height: '1.125rem' }}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/90 shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Powered by OCTAPUS Badge */}
      <div className="border-t border-border/80 p-3.5">
        <div className="rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-3 dark:border-violet-900/40 dark:from-violet-950/40 dark:to-indigo-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold tracking-wider text-primary">OCTAPUS</span>
              <span className="text-[10px] text-muted-foreground font-semibold">POS</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v2.5 Live
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Powered by OCTAPUS Cloud</p>
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
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar-background lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile slide drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-visibility duration-300",
          mobileOpen ? "visible" : "invisible pointer-events-none"
        )}
      >
        {/* Backdrop with fade animation */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />

        {/* Slide-in sidebar panel */}
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-72 border-r border-sidebar-border bg-sidebar-background shadow-2xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="absolute right-3.5 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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