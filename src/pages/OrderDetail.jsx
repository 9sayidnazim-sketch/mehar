import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate, daysUntil } from '@/lib/mehar-utils';
import { downloadOrderBill } from '@/lib/pdf-utils';
import {
  ArrowLeft, User, Ruler, Shirt, DollarSign,
  MessageCircle, Mail, Printer, Check, Plus
} from 'lucide-react';
import WhatsAppLinkModal from '@/components/WhatsAppLinkModal';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const STATUS_FLOW = ['Booked', 'Cutting', 'Assigned', 'Stitching', 'Quality Check', 'Trial', 'Alteration', 'Ready', 'Delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [sendingPayment, setSendingPayment] = useState(null);
  const [waLinkModalOpen, setWaLinkModalOpen] = useState(false);

  // Record Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  useEffect(() => {
    load();
    const handleSync = (e) => {
      const ent = e.detail?.entity;
      if (!ent || ent === 'Order' || ent === 'Payment' || ent === 'Customer') {
        load();
      }
    };
    window.addEventListener('thredo-data-updated', handleSync);
    return () => window.removeEventListener('thredo-data-updated', handleSync);
  }, [id]);

  const load = async () => {
    try {
      const [o, p] = await Promise.all([
        db.entities.Order.get(id),
        db.entities.Payment.filter({ order_id: id }, '-created_date', 20),
      ]);
      setOrder(o);
      const paymentList = Array.isArray(p) ? p : (p?.items || []);
      setPayments(paymentList);
      if (o?.customer_id) {
        try { setCustomer(await db.entities.Customer.get(o.customer_id)); } catch (e) { /* ignore */ }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const sendInvoice = async (paymentId) => {
    setSendingPayment(paymentId);
    const targetPayment = payments.find(p => p.id === paymentId) || { id: paymentId };
    const recipientPhone = customer?.whatsapp || customer?.phone || order?.customer_phone || '';
    try {
      const res = await db.functions.invoke('sendWhatsAppInvoice', {
        payment_id: paymentId,
        order_id: order?.id,
        order_ref: order?.order_id,
        customer_id: order?.customer_id,
        customer_name: order?.customer_name,
        phone: recipientPhone,
        payment_draft: targetPayment,
        order_draft: order,
        customer_draft: customer,
      });
      if (res?.timed_out || res?.error?.includes('Result unknown')) {
        toast({
          title: 'Result unknown—check before retrying',
          description: 'The WhatsApp gateway request timed out. Do not automatically resend before checking.',
          variant: 'destructive',
          duration: 8000
        });
      } else if (res?.skipped) {
        toast({ title: 'Refund payment — no invoice sent' });
      } else if (res?.success || res?.message_id) {
        toast({ title: 'Invoice Submitted', description: `PDF invoice submitted to WhatsApp (+${res?.to || order.customer_name}). Status: Submitted.` });
      } else {
        if (res?.not_logged_in || res?.error?.includes('not connected or logged in')) {
          setWaLinkModalOpen(true);
        }
        toast({ title: 'WhatsApp dispatch failed', description: res?.error || 'Failed to dispatch via Orbit', variant: 'destructive' });
      }
    } catch (e) {
      if (e.name === 'AbortError' || e.message?.includes('timeout') || e.message?.includes('Result unknown')) {
        toast({
          title: 'Result unknown—check before retrying',
          description: 'The WhatsApp gateway request timed out.',
          variant: 'destructive',
          duration: 8000
        });
      } else {
        toast({ title: 'WhatsApp send failed', description: e.message, variant: 'destructive' });
      }
    } finally {
      setSendingPayment(null);
    }
  };

  const sendLatestInvoice = () => {
    if (!payments.length) {
      toast({ title: 'No payment yet', description: 'Record a payment first — the invoice is generated per payment.', variant: 'destructive' });
      return;
    }
    sendInvoice(payments[0].id);
  };

  const handleRecordPayment = async () => {
    const num = parseFloat(payAmount);
    if (!num || num <= 0) return;
    setSavingPay(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await db.entities.Payment.create({
        order_id: order.id,
        order_ref: order.order_id || (order.id ? String(order.id).slice(-6) : 'ORD'),
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        amount: num,
        payment_method: payMethod,
        date: today,
        reference_number: payRef,
        type: 'payment',
      });

      const newPaid = (order.amount_paid || 0) + num;
      const total = order.total_amount || 0;
      const balance = Math.max(0, total - newPaid);
      const payStatus = newPaid >= total ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

      await db.entities.Order.update(order.id, {
        amount_paid: newPaid,
        balance_due: balance,
        payment_status: payStatus,
      });

      if (order.customer_id) {
        try {
          const cust = await db.entities.Customer.get(order.customer_id);
          if (cust) {
            const curBalance = cust.outstanding_balance || 0;
            await db.entities.Customer.update(order.customer_id, {
              outstanding_balance: Math.max(0, curBalance - num)
            });
          }
        } catch (_) {}
      }

      toast({
        title: 'Payment Recorded',
        description: `${formatCurrency(num)} via ${payMethod} recorded successfully.`,
      });
      setShowPayModal(false);
      setPayAmount('');
      setPayRef('');
      load();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Failed to record payment',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingPay(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>;
  }
  if (!order) {
    return <div className="p-8 text-center"><p className="text-muted-foreground">Order not found.</p><Link to="/orders"><Button variant="link">Back to orders</Button></Link></div>;
  }

  const statusIdx = STATUS_FLOW.indexOf(order.status);
  const days = daysUntil(order.delivery_date);
  const overdue = order.status !== 'Delivered' && order.status !== 'Cancelled' && days !== null && days < 0;

  const changeStatus = async (newStatus) => {
    try {
      await db.entities.Order.update(id, { status: newStatus });
      toast({ title: 'Status updated', description: `Order status changed to ${newStatus}.` });
      load();
    } catch (err) {
      toast({ title: 'Failed to update status', description: err.message, variant: 'destructive' });
    }
  };

  const sections = [
    { icon: User, title: 'Booking Details', rows: [
      ['Order ID', order.order_id || (order.id ? String(order.id).slice(-6) : '—')],
      ['Customer', order.customer_name],
      ['Booking Date', formatDate(order.booking_date)],
      ['Delivery Date', formatDate(order.delivery_date)],
      ['Priority', order.priority],
      ['Order Type', order.order_type],
    ]},
    { icon: Shirt, title: 'Fabric & Style', rows: [
      ['Fabric', order.fabric_type || '—'],
      ['Code', order.fabric_code || '—'],
      ['Quantity', order.fabric_quantity ? `${order.fabric_quantity}m` : '—'],
      ['Supplier', order.supplier || '—'],
      ['Style Notes', order.style_notes || '—'],
    ]},
    { icon: DollarSign, title: 'Pricing', rows: [
      ['Subtotal', formatCurrency(order.subtotal)],
      ['Tax', `${order.tax_percent || 5}%`],
      ['Total', formatCurrency(order.total_amount)],
      ['Paid', formatCurrency(order.amount_paid)],
      ['Balance', formatCurrency(order.balance_due)],
    ]},
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-shadow rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{order.order_id || (order.id ? String(order.id).slice(-6) : '—')}</h1>
              <StatusBadge status={order.status} />
              <StatusBadge status={order.priority} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.customer_name} • Booked {formatDate(order.booking_date)}
            </p>
            {days !== null && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
              <p className={`mt-1 text-sm font-medium ${overdue ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {overdue ? `${Math.abs(days)} days overdue` : `${days} days to delivery`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setPayAmount(order.balance_due > 0 ? String(order.balance_due) : '');
                setShowPayModal(true);
              }}
            >
              <DollarSign className="h-4 w-4" /> Record Payment
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={sendLatestInvoice}><MessageCircle className="h-4 w-4" /> Send Invoice</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Mail className="h-4 w-4" /> Email</Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadOrderBill(order, payments, customer)}><Printer className="h-4 w-4" /> Print</Button>
          </div>
        </div>

        {/* Status timeline */}
        {order.status !== 'Cancelled' && (
          <div className="mt-6 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1">
              {STATUS_FLOW.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold transition-all ${
                      i < statusIdx ? 'bg-emerald-500 text-white' :
                      i === statusIdx ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {i < statusIdx ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-[10px] ${i <= statusIdx ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && <div className={`h-0.5 w-6 ${i < statusIdx ? 'bg-emerald-500' : 'bg-muted'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Change status */}
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Update status:</span>
          <Select value={order.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Detail sections */}
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((sec) => (
          <div key={sec.title} className="card-shadow rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><sec.icon className="h-4 w-4 text-primary" /> {sec.title}</h3>
            <div className="space-y-2">
              {sec.rows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Measurements */}
      {order.measurement_values && Object.keys(order.measurement_values).length > 0 && (
        <div className="card-shadow rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Ruler className="h-4 w-4 text-primary" /> Measurements ({order.template_name})</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(order.measurement_values).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="font-medium">{v || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><DollarSign className="h-4 w-4 text-primary" /> Payment History</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPayAmount(order.balance_due > 0 ? String(order.balance_due) : '');
                setShowPayModal(true);
              }}
              className="h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Plus className="h-3.5 w-3.5" /> Record Payment
            </Button>
          </div>
          <StatusBadge status={order.payment_status} />
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 text-right font-medium">Invoice (WhatsApp)</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-muted-foreground">{formatDate(p.date)}</td>
                  <td className="py-2 font-medium">{formatCurrency(p.amount)}</td>
                  <td className="py-2">{p.payment_method}</td>
                  <td className="py-2 capitalize">{p.type}</td>
                  <td className="py-2 text-right">
                    {p.type !== 'refund' ? (
                      <button
                        onClick={() => sendInvoice(p.id)}
                        disabled={sendingPayment === p.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {sendingPayment === p.id ? 'Submitting…' : 'Send invoice on WhatsApp'}
                      </button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {order.remarks && (
        <div className="card-shadow rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 font-semibold">Remarks</h3>
          <p className="text-sm text-muted-foreground">{order.remarks}</p>
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Order Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-semibold">{order.order_id || (order.id ? String(order.id).slice(-6) : '—')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Order Amount:</span>
                <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(order.amount_paid)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="text-muted-foreground font-medium">Balance Due:</span>
                <span className="font-bold text-amber-600">{formatCurrency(order.balance_due)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Amount (AED) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus:border-primary"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ref / Receipt #</Label>
                <Input
                  placeholder="Optional reference"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
            <Button
              onClick={handleRecordPayment}
              disabled={savingPay || !payAmount || parseFloat(payAmount) <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingPay ? 'Recording...' : 'Save Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WhatsAppLinkModal
        open={waLinkModalOpen}
        onOpenChange={setWaLinkModalOpen}
      />
    </div>
  );
}