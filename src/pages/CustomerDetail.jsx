import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/mehar-utils';
import {
  ArrowLeft, Phone, Mail, MapPin, ShoppingBag, Wallet,
  Plus, MessageCircle, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');

  useEffect(() => {
    (async () => {
      try {
        const [cust, allOrders, allPayments, allMeasurements] = await Promise.all([
          db.entities.Customer.get(id),
          db.entities.Order.filter({ customer_id: id }, '-created_date', 50),
          db.entities.Payment.filter({ customer_id: id }, '-created_date', 50),
          db.entities.Measurement.filter({ customer_id: id }, '-created_date', 50),
        ]);
        setCustomer(cust);
        setOrders(allOrders);
        setPayments(allPayments);
        setMeasurements(allMeasurements);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Customer not found.</p>
        <Link to="/customers"><Button variant="link">Back to customers</Button></Link>
      </div>
    );
  }

  const tabs = [
    { key: 'orders', label: `Orders (${orders.length})` },
    { key: 'payments', label: `Payments (${payments.length})` },
    { key: 'measurements', label: `Measurements (${measurements.length})` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-shadow rounded-xl border border-border bg-card p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-xl font-bold text-white shadow-md">
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{customer.name}</h1>
                <StatusBadge status={customer.status || 'active'} />
              </div>
              <p className="text-sm text-muted-foreground">Customer since {formatDate(customer.created_date)}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
                {customer.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {customer.city}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><CreditCard className="h-4 w-4" /> Payment</Button>
            <Link to={`/orders?new=1&customer=${id}`}>
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> Add Order</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Orders</p>
            <p className="text-lg font-bold">{customer.total_orders || orders.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-lg font-bold">{formatCurrency(customer.total_spent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(customer.outstanding_balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Measurements</p>
            <p className="text-lg font-bold">{measurements.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="card-shadow overflow-hidden rounded-xl border border-border bg-card">
          {orders.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center">
              <ShoppingBag className="mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.order_id || o.id.slice(-6)}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.booking_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={o.payment_status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card-shadow overflow-hidden rounded-xl border border-border bg-card">
          {payments.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center">
              <Wallet className="mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No payments recorded.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">{p.payment_method}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.type === 'refund' ? 'Pending' : 'Paid'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'measurements' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {measurements.length === 0 ? (
            <div className="card-shadow col-span-2 flex h-32 flex-col items-center justify-center rounded-xl border border-border bg-card">
              <p className="text-sm text-muted-foreground">No measurements recorded yet.</p>
            </div>
          ) : measurements.map((m) => (
            <div key={m.id} className="card-shadow rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold">{m.template_name}</h4>
                <span className="text-xs text-muted-foreground">{formatDate(m.date)}</span>
              </div>
              {m.values && typeof m.values === 'object' && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(m.values).slice(0, 8).map(([k, v]) => (
                    <div key={k} className="flex justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.notes && <p className="mt-3 text-xs text-muted-foreground">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}