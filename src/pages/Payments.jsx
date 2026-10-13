import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { formatCurrency, formatDate } from '@/lib/mehar-utils';
import { exportPaymentsPdf } from '@/lib/pdf-utils';
import { CreditCard, Plus, Wallet, TrendingDown, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import KpiCard from '@/components/KpiCard';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [preOrderId, setPreOrderId] = useState(null);

  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get('order');
    if (pre) { setShowAdd(true); setPreOrderId(pre); }
    load();
  }, []);

  const load = async () => {
    try {
      const [p, o] = await Promise.all([
        db.entities.Payment.list('-created_date', 100),
        db.entities.Order.list('-created_date', 100),
      ]);
      setPayments(p);
      setOrders(o);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const totalCollected = payments.filter((p) => p.type !== 'refund').reduce((s, p) => s + (p.amount || 0), 0);
  const totalRefunds = payments.filter((p) => p.type === 'refund').reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding = orders.reduce((s, o) => s + (o.balance_due || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">Track collections, outstanding balances, and refunds</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportPaymentsPdf(payments)}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard index={0} label="Total Collected" value={formatCurrency(totalCollected)} icon={Wallet} accent="accent" />
        <KpiCard index={1} label="Outstanding" value={formatCurrency(outstanding)} icon={TrendingDown} accent="warning" />
        <KpiCard index={2} label="Refunds" value={formatCurrency(totalRefunds)} icon={CreditCard} accent="danger" />
      </div>

      <div className="card-shadow overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
        ) : payments.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center">
            <CreditCard className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">
                      {p.order_id ? <Link to={`/orders/${p.order_id}`} className="font-medium text-primary hover:underline">{p.order_ref || p.order_id.slice(-6)}</Link> : '—'}
                    </td>
                    <td className="px-4 py-3">{p.customer_name}</td>
                    <td className="px-4 py-3">{p.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.type === 'refund' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        p.type === 'advance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>{p.type}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${p.type === 'refund' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {p.type === 'refund' ? '-' : ''}{formatCurrency(p.amount)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordPaymentDialog open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} orders={orders} preOrderId={preOrderId} />
    </div>
  );
}

function RecordPaymentDialog({ open, onClose, onCreated, orders, preOrderId }) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && preOrderId) setOrderId(preOrderId);
  }, [open, preOrderId]);

  const selectedOrder = orders.find((o) => o.id === orderId);

  const submit = async () => {
    if (!orderId || !amount) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await db.entities.Payment.create({
        order_id: orderId,
        order_ref: selectedOrder?.order_id,
        customer_id: selectedOrder?.customer_id,
        customer_name: selectedOrder?.customer_name,
        amount,
        payment_method: method,
        date: today,
        reference_number: reference,
        type: 'payment',
      });
      // Update order
      const newPaid = (selectedOrder?.amount_paid || 0) + amount;
      const total = selectedOrder?.total_amount || 0;
      await db.entities.Order.update(orderId, {
        amount_paid: newPaid,
        balance_due: total - newPaid,
        payment_status: newPaid >= total ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending',
      });
      setOrderId(''); setAmount(0); setMethod('Cash'); setReference('');
      onCreated();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Order *</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger><SelectValue placeholder="Select order..." /></SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.order_id || o.id.slice(-6)} — {o.customer_name} (Due: {formatCurrency(o.balance_due)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedOrder && (
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{formatCurrency(selectedOrder.total_amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{formatCurrency(selectedOrder.amount_paid)}</span></div>
              <div className="flex justify-between font-medium text-amber-600"><span>Balance Due</span><span>{formatCurrency(selectedOrder.balance_due)}</span></div>
            </div>
          )}
          <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} /></div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Reference Number</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !orderId || !amount} className="bg-primary hover:bg-primary/90">{saving ? 'Saving...' : 'Record Payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}