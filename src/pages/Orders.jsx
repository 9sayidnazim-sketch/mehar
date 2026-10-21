import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate, daysUntil } from '@/lib/mehar-utils';
import { exportOrdersPdf } from '@/lib/pdf-utils';
import {
  Plus, Search, Download, ClipboardList, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUSES = ['Booked', 'Cutting', 'Assigned', 'Stitching', 'Quality Check', 'Trial', 'Alteration', 'Ready', 'Delivered', 'Cancelled'];

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [params] = useSearchParams();

  useEffect(() => {
    loadOrders();
    const handleSync = (e) => {
      if (!e.detail?.entity || e.detail.entity === 'Order' || e.detail.entity === 'Payment') {
        loadOrders();
      }
    };
    window.addEventListener('thredo-data-updated', handleSync);
    return () => window.removeEventListener('thredo-data-updated', handleSync);
  }, []);

  useEffect(() => {
    if (params.get('new') === '1') {
      navigate('/orders/new');
    }
  }, [params, navigate]);

  const loadOrders = async () => {
    try {
      const data = await db.entities.Order.list('-created_date', 200);
      const list = Array.isArray(data) ? data : (data?.items || []);
      setOrders(list);
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.order_id?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => window.history.back()} aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground">{orders.length} total orders</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportOrdersPdf(filtered)}><Download className="h-4 w-4" /> Export</Button>
          <Link to="/orders/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> New Order</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['All', ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card-shadow overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No orders found.</p>
            <Link to="/orders/new"><Button variant="link" className="mt-1">Create your first order</Button></Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Delivery</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const days = daysUntil(o.delivery_date);
                  const overdue = o.status !== 'Delivered' && o.status !== 'Cancelled' && days !== null && days < 0;
                  return (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      onClick={() => navigate(`/orders/${o.id}`)}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-primary hover:underline">
                        {o.order_id || (o.id ? String(o.id).slice(-6) : '—')}
                      </td>
                      <td className="px-4 py-3">{o.customer_name}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3"><StatusBadge status={o.priority} /></td>
                      <td className="px-4 py-3">
                        <span className={overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {formatDate(o.delivery_date)}
                          {overdue && <span className="block text-[10px] text-red-500">Overdue</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={o.payment_status} /></td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.total_amount)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}