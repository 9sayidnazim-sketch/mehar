import { db, onDbUpdate } from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

import { formatCurrency } from '@/lib/mehar-utils';
import { format, subDays, startOfMonth } from 'date-fns';
import KpiCard from '@/components/KpiCard';
import StatusBadge from '@/components/StatusBadge';
import {
  ShoppingBag, Package, Scissors, AlertTriangle, Wallet,
  TrendingUp, DollarSign, Plus, Search, CreditCard, UserPlus,
  ShoppingCart, Settings as SettingsIcon, Building2, X, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import QuickActionDialog from '@/components/QuickActionDialog';

const STATUS_COLORS = {
  Booked: '#8b5cf6',
  Cutting: '#f59e0b',
  Assigned: '#0ea5e9',
  Stitching: '#6366f1',
  'Quality Check': '#06b6d4',
  Trial: '#d946ef',
  Alteration: '#f97316',
  Ready: '#14b8a6',
  Delivered: '#059669',
  Cancelled: '#ef4444',
};

const quickActions = [
  { label: 'New Order', icon: Plus, to: '/orders/new', accent: 'bg-violet-600' },
  { label: 'New Sale (POS)', icon: ShoppingCart, to: '/sales', accent: 'bg-rose-600' },
  { label: 'Search Order', icon: Search, accent: 'bg-blue-600', pick: 'order', pickTo: (o) => `/orders/${o.id}` },
  { label: 'Record Payment', icon: CreditCard, accent: 'bg-amber-600', pick: 'order', pickTo: (o) => `/payments?order=${o.id}` },
  { label: 'New Customer', icon: UserPlus, to: '/customers?new=1', accent: 'bg-indigo-600' },
  { label: 'Workshop', icon: Scissors, to: '/tailors', accent: 'bg-teal-600' },
  { label: 'All Orders', icon: Package, to: '/orders', accent: 'bg-emerald-600' },
  { label: 'Settings', icon: SettingsIcon, to: '/settings', accent: 'bg-slate-600' },
];

const fmtDate = (d) => format(d, 'yyyy-MM-dd');

export default function Dashboard() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState(null);
  const [quickAction, setQuickAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companySetupNeeded, setCompanySetupNeeded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const [orders, sales, payments, companies] = await Promise.all([
        db.entities.Order.list('-created_date', 500),
        db.entities.Sale.list('-created_date', 200),
        db.entities.Payment.list('-created_date', 200),
        db.entities.Company.list('-created_date', 5),
      ]);
      setRaw({ orders, sales, payments });
      if (companies.length === 0) setCompanySetupNeeded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const unsubscribe = onDbUpdate(['Order', 'Sale', 'Payment', 'Company'], () => {
      loadDashboard();
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setTimeout(() => setRefreshing(false), 400);
    toast({
      title: 'Dashboard Refreshed',
      description: 'KPIs, order pipelines, and daily revenue updated.'
    });
  };

  const m = useMemo(() => {
    if (!raw) return null;
    const { orders, sales, payments } = raw;
    const today = fmtDate(new Date());
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const isClosed = (o) => o.status === 'Delivered' || o.status === 'Cancelled';

    const todaysOrders = orders.filter(o => o.booking_date === today).length;
    const ready = orders.filter(o => o.status === 'Ready').length;
    const inStitch = orders.filter(o => o.status === 'Stitching' || o.status === 'Cutting').length;
    const delayed = orders.filter(o => !isClosed(o) && o.delivery_date && o.delivery_date < today).length;
    const collectionsToday = payments
      .filter(p => p.date === today && p.type !== 'refund')
      .reduce((s, p) => s + (p.amount || 0), 0);
    const pos = (n) => Math.max(0, n || 0);
    const outstanding =
      orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + pos(o.balance_due), 0) +
      sales.filter(s => s.status !== 'Cancelled' && s.status !== 'Refunded').reduce((s, s2) => s + pos(s2.balance_due), 0);

    const monthOrdersRev = orders
      .filter(o => o.booking_date && o.booking_date >= monthStart && o.status !== 'Cancelled')
      .reduce((s, o) => s + (o.total_amount || 0), 0);
    const monthSalesRev = sales
      .filter(s => s.date && s.date >= monthStart && s.status !== 'Cancelled' && s.status !== 'Refunded')
      .reduce((s, s2) => s + (s2.total || 0), 0);
    const revenue = monthOrdersRev + monthSalesRev;
    const monthCosts = orders
      .filter(o => o.booking_date && o.booking_date >= monthStart && o.status !== 'Cancelled')
      .reduce((s, o) => s + (o.tailor_rate || 0) + (o.fabric_cost || 0), 0);
    const profit = revenue - monthCosts;

    // status distribution
    const statusCounts = {};
    orders.forEach(o => { if (o.status) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
    const statusData = Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#94a3b8' }))
      .sort((a, b) => b.value - a.value);

    // tailor productivity
    const tailorCounts = {};
    orders.forEach(o => { if (o.tailor_name) tailorCounts[o.tailor_name] = (tailorCounts[o.tailor_name] || 0) + 1; });
    const tailorData = Object.entries(tailorCounts)
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 6);

    // revenue trend last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.push({ key: fmtDate(d), day: format(d, 'MMM dd'), revenue: 0, orders: 0 });
    }
    const dayMap = Object.fromEntries(days.map(d => [d.key, d]));
    orders.forEach(o => {
      if (o.booking_date && dayMap[o.booking_date]) {
        dayMap[o.booking_date].revenue += (o.total_amount || 0);
        dayMap[o.booking_date].orders += 1;
      }
    });
    sales.forEach(s => {
      if (s.date && dayMap[s.date]) dayMap[s.date].revenue += (s.total || 0);
    });

    return {
      todaysOrders, ready, inStitch, delayed,
      collectionsToday, outstanding, revenue, profit,
      statusData, tailorData, revenueData: days,
      recentOrders: orders.slice(0, 6),
    };
  }, [raw]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back — here's your tailoring business at a glance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Link to="/orders/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      {companySetupNeeded && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Set up your Company profile</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Your business name & details appear on every bill, invoice, and WhatsApp / email message.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/settings">
              <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700">
                <Building2 className="h-4 w-4" /> Set up now
              </Button>
            </Link>
            <Button size="icon" variant="ghost" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Quick actions — top */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => (a.to ? navigate(a.to) : setQuickAction(a))}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.accent} text-white transition-transform group-hover:scale-105`}>
                <a.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard index={0} label="Today's Orders" value={m ? m.todaysOrders : '—'} icon={ShoppingBag} accent="primary" trend="Booked today" />
        <KpiCard index={1} label="Ready for Delivery" value={m ? m.ready : '—'} icon={Package} accent="accent" trend="Awaiting dispatch" />
        <KpiCard index={2} label="In Stitching" value={m ? m.inStitch : '—'} icon={Scissors} accent="blue" trend="In progress" />
        <KpiCard index={3} label="Delayed Orders" value={m ? m.delayed : '—'} icon={AlertTriangle} accent="danger" trend="Past delivery date" />
        <KpiCard index={4} label="Collections Today" value={m ? formatCurrency(m.collectionsToday) : '—'} icon={Wallet} accent="accent" trend="Cash + digital" />
        <KpiCard index={5} label="Outstanding" value={m ? formatCurrency(m.outstanding) : '—'} icon={AlertTriangle} accent="warning" trend="Unpaid balances" />
        <KpiCard index={6} label="Revenue (Month)" value={m ? formatCurrency(m.revenue) : '—'} icon={TrendingUp} accent="primary" trend="This month" />
        <KpiCard index={7} label="Profit" value={m ? formatCurrency(m.profit) : '—'} icon={DollarSign} accent="accent" trend="After tailor + fabric costs" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-shadow rounded-xl border border-border bg-card p-5 lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Revenue Trend</h3>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </div>
          {loading || !m ? (
            <div className="flex h-[260px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={m.revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B3DF5" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#5B3DF5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#5B3DF5" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-shadow rounded-xl border border-border bg-card p-5"
        >
          <h3 className="mb-1 font-semibold">Orders by Status</h3>
          <p className="text-xs text-muted-foreground">Current distribution</p>
          {loading || !m ? (
            <div className="flex h-[220px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : m.statusData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={m.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {m.statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-2">
                {m.statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Second chart row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-shadow rounded-xl border border-border bg-card p-5"
        >
          <h3 className="mb-4 font-semibold">Tailor Productivity</h3>
          {loading || !m ? (
            <div className="flex h-[240px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : m.tailorData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">No tailor assignments yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.tailorData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Bar dataKey="orders" fill="#5B3DF5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Recent orders */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-shadow rounded-xl border border-border bg-card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Recent Orders</h3>
          <Link to="/orders" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : !m || m.recentOrders.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-center">
            <ShoppingBag className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No orders yet. Create your first order to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Order ID</th>
                  <th className="pb-2 pr-4 font-medium">Customer</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Delivery</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {m.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 pr-4">
                      <Link to={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                        {o.order_id || o.id.slice(-6)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{o.customer_name}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={o.status} /></td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{o.delivery_date || '—'}</td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <QuickActionDialog action={quickAction} onClose={() => setQuickAction(null)} />
    </div>
  );
}