import { db, formatWhatsAppNumber } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate, daysUntil } from '@/lib/mehar-utils';
import { downloadOrderBill } from '@/lib/pdf-utils';
import {
  ArrowLeft, User, Ruler, Shirt, DollarSign,
  MessageCircle, Mail, Printer, Check, AlertTriangle, Loader2, Clock
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_FLOW = ['Booked', 'Cutting', 'Assigned', 'Stitching', 'Quality Check', 'Trial', 'Alteration', 'Ready', 'Delivered'];

const COUNTRY_CODES = [
  { code: '971', label: 'UAE (+971)', flag: '🇦🇪' },
  { code: '966', label: 'Saudi Arabia (+966)', flag: '🇸🇦' },
  { code: '974', label: 'Qatar (+974)', flag: '🇶🇦' },
  { code: '965', label: 'Kuwait (+965)', flag: '🇰🇼' },
  { code: '968', label: 'Oman (+968)', flag: '🇴🇲' },
  { code: '973', label: 'Bahrain (+973)', flag: '🇧🇭' },
  { code: '91', label: 'India (+91)', flag: '🇮🇳' },
  { code: '92', label: 'Pakistan (+92)', flag: '🇵🇰' },
  { code: '44', label: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: '1', label: 'United States (+1)', flag: '🇺🇸' },
  { code: '20', label: 'Egypt (+20)', flag: '🇪🇬' },
  { code: '63', label: 'Philippines (+63)', flag: '🇵🇭' },
  { code: '880', label: 'Bangladesh (+880)', flag: '🇧🇩' },
];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // WhatsApp Send Modal State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTargetPaymentId, setWaTargetPaymentId] = useState(null);
  const [waPhone, setWaPhone] = useState('');
  const [waCountryCode, setWaCountryCode] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waConfirmResend, setWaConfirmResend] = useState(false);
  const [waHistory, setWaHistory] = useState([]);
  const [waIdempotencyKey, setWaIdempotencyKey] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [gatewayChecking, setGatewayChecking] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const [o, p] = await Promise.all([
        db.entities.Order.get(id),
        db.entities.Payment.filter({ order_id: id }, '-created_date', 20),
      ]);
      setOrder(o);
      setPayments(p);
      if (o?.customer_id) {
        try { setCustomer(await db.entities.Customer.get(o.customer_id)); } catch (e) { /* ignore */ }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openWhatsAppModal = async (paymentId = null) => {
    setWaTargetPaymentId(paymentId);
    const initialPhone = customer?.phone || customer?.whatsapp || order?.customer_phone || '';
    let detectedCountry = '';
    const cleanDigits = initialPhone.replace(/[^0-9]/g, '');
    for (const c of COUNTRY_CODES) {
      if (cleanDigits.startsWith(c.code)) {
        detectedCountry = c.code;
        break;
      }
    }
    setWaPhone(initialPhone);
    setWaCountryCode(detectedCountry);
    setWaConfirmResend(false);
    setWaIdempotencyKey(`idem-order-${id}-${Date.now()}`);
    setWaModalOpen(true);

    try {
      setGatewayChecking(true);
      const [statusRes, histRes] = await Promise.all([
        fetch('/api/invoices/whatsapp-status'),
        fetch(`/api/invoices/whatsapp-history?invoice_id=${id}`)
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setGatewayStatus(data);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setWaHistory(histData.records || []);
      }
    } catch (_) {
    } finally {
      setGatewayChecking(false);
    }
  };

  const handleSendWhatsAppInvoice = async () => {
    const check = formatWhatsAppNumber(waPhone, waCountryCode);
    if (!check.isValid) {
      toast({
        title: 'Country Code Required',
        description: check.error || 'Please enter a valid WhatsApp number with country code. Do not assume a country.',
        variant: 'destructive'
      });
      return;
    }

    setWaSending(true);
    const idempotencyKey = waIdempotencyKey || `idem-order-${id}-${Date.now()}`;

    try {
      const res = await db.functions.invoke('sendWhatsAppInvoice', {
        order_id: id,
        payment_id: waTargetPaymentId,
        idempotency_key: idempotencyKey,
        phone: check.formatted,
        preview_recipient: check.formatted,
        confirm_resend: waConfirmResend,
        country_code: waCountryCode
      });

      if (res.success) {
        toast({
          title: 'Invoice Submitted to WhatsApp Gateway',
          description: `Order invoice ${order.order_id || id} submitted for dispatch to +${res.formatted_number || check.formatted} (Status: Submitted).`
        });
        setWaModalOpen(false);
        await load();
      } else if (res.duplicate_prevented) {
        toast({
          title: 'Duplicate Send Prevented',
          description: res.error || 'This invoice has already been sent. Please confirm deliberate resend after reviewing history.',
          variant: 'destructive'
        });
      } else if (res.phone_changed) {
        toast({
          title: 'Recipient Number Changed',
          description: res.error || 'Customer phone number changed after preview. Confirmation required.',
          variant: 'destructive'
        });
      } else if (res.pairing_needed) {
        toast({
          title: 'WhatsApp is not paired',
          description: res.error || 'Connect the sender account before sending this invoice.',
          variant: 'destructive'
        });
      } else if (res.status === 'unknown') {
        toast({
          title: 'Gateway Timeout (Result Unknown)',
          description: 'Gateway timed out. Result is unknown — do not automatically resend.',
          variant: 'destructive'
        });
        await load();
      } else {
        toast({
          title: 'WhatsApp Dispatch Failed',
          description: res.error || 'Failed to dispatch message via gateway',
          variant: 'destructive'
        });
        await load();
      }
    } catch (err) {
      toast({
        title: 'Error sending invoice',
        description: err.message || 'WhatsApp gateway communication error',
        variant: 'destructive'
      });
    } finally {
      setWaSending(false);
    }
  };

  const handleEmailInvoice = () => {
    const custEmail = customer?.email || order?.customer_email;
    if (!custEmail) {
      toast({ title: 'No email found', description: 'Customer does not have an email address recorded.', variant: 'destructive' });
      return;
    }
    const subject = encodeURIComponent(`Invoice for Order ${order.order_id} — THREDO Tailoring POS`);
    const body = encodeURIComponent(`Dear ${order.customer_name},\n\nYour order ${order.order_id} has been recorded.\nTotal Amount: AED ${order.total_amount}\nBalance Due: AED ${order.balance_due}\nDelivery Date: ${formatDate(order.delivery_date)}\n\nThank you for choosing THREDO!`);
    window.location.href = `mailto:${custEmail}?subject=${subject}&body=${body}`;
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
    await db.entities.Order.update(id, { status: newStatus });
    load();
  };

  const sections = [
    { icon: User, title: 'Booking Details', rows: [
      ['Order ID', order.order_id],
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
      ['Tax', `${order.tax_percent}%`],
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
              <h1 className="text-xl font-bold">{order.order_id || id.slice(-6)}</h1>
              <StatusBadge status={order.status} />
              <StatusBadge status={order.priority} />
              {order.whatsapp_status && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  order.whatsapp_status === 'delivered' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                  order.whatsapp_status === 'read' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                  order.whatsapp_status === 'submitted' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                  order.whatsapp_status === 'unknown' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}>
                  <MessageCircle className="h-3 w-3" />
                  WA: {order.whatsapp_status === 'submitted' ? 'Submitted' : order.whatsapp_status === 'delivered' ? 'Delivered' : order.whatsapp_status === 'read' ? 'Read' : order.whatsapp_status === 'unknown' ? 'Unknown' : 'Failed'}
                </span>
              )}
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openWhatsAppModal(payments[0]?.id || null)}>
              <MessageCircle className="h-4 w-4 text-emerald-600" /> Send invoice on WhatsApp
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEmailInvoice}><Mail className="h-4 w-4" /> Email</Button>
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
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><DollarSign className="h-4 w-4 text-primary" /> Payment History</h3>
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
                        onClick={() => openWhatsAppModal(p.id)}
                        disabled={waSending}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Send on WhatsApp
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

      {/* Modal: Send Invoice on WhatsApp with Destination Number Display */}
      <Dialog open={waModalOpen} onOpenChange={(open) => { if (!open) setWaModalOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Send invoice on WhatsApp
            </DialogTitle>
          </DialogHeader>

          {order && (() => {
            const phoneCheck = formatWhatsAppNumber(waPhone, waCountryCode);
            const isAlreadySent = order.whatsapp_status === 'pending' || order.whatsapp_status === 'submitted' || order.whatsapp_status === 'sent' || order.whatsapp_status === 'delivered' || order.whatsapp_status === 'unknown' || order.bill_sent_whatsapp || (waHistory && waHistory.length > 0);

            return (
              <div className="space-y-4 py-2">
                {/* Destination Recipient Banner */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      Destination Recipient
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      PDF Attachment Target
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-base font-mono font-bold text-foreground">
                      {phoneCheck.formatted ? `+${phoneCheck.formatted}` : (waPhone ? waPhone : 'No number provided')}
                    </span>
                    <span className="text-xs">
                      {phoneCheck.isValid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          ✓ Verified with country code
                        </span>
                      ) : (
                        <span className="text-destructive font-semibold">
                          ⚠ Country code required
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    PDF Attachment: <span className="font-mono text-foreground font-medium">invoice-{order.order_id || id}.pdf</span>
                  </p>
                </div>

                {/* Orbit Gateway Status Alerts */}
                {gatewayStatus?.errorCategory === 'unauthorized' && (
                  <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <div>
                      <p className="font-semibold">Authentication Failed (HTTP 401 Unauthorized)</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        The Orbit instance token is unverified or invalid. Connect the sender account and configure a valid instance token before sending.
                      </p>
                    </div>
                  </div>
                )}

                {gatewayStatus && !gatewayStatus.loggedIn && gatewayStatus.errorCategory !== 'unauthorized' && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">WhatsApp is not paired</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Connect the sender account before sending this invoice.
                      </p>
                    </div>
                  </div>
                )}

                {/* Duplicate Send Protection & Confirmed Resend Action */}
                {isAlreadySent && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-semibold">
                          Active Dispatch Record Exists ({order.sent_at ? formatDate(order.sent_at) : 'Submitted'})
                        </p>
                        <p className="text-[11px] opacity-80 mt-0.5">
                          This invoice already has an active send record. Any deliberate resend must be a separately confirmed action after reviewing send history.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-amber-900 dark:text-amber-200 select-none">
                      <input
                        type="checkbox"
                        checked={waConfirmResend}
                        onChange={(e) => setWaConfirmResend(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      I confirm deliberate resend of this invoice after reviewing history
                    </label>
                  </div>
                )}

                {/* Read-Only Order Summary */}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-xs">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Customer (read only)</Label>
                    <Input
                      value={order.customer_name || 'Customer'}
                      readOnly
                      disabled
                      className="mt-1 h-8 text-xs font-semibold bg-background cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Order ID & Total (read only)</Label>
                    <Input
                      value={`${order.order_id || id} • ${formatCurrency(order.total_amount)}`}
                      readOnly
                      disabled
                      className="mt-1 h-8 text-xs font-mono font-semibold bg-background cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Customer Phone & Country Code */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Customer WhatsApp Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <div className="w-[140px] shrink-0">
                      <Select
                        value={waCountryCode}
                        onValueChange={(val) => setWaCountryCode(val)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c.code} value={c.code} className="text-xs">
                              {c.flag} +{c.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value)}
                        placeholder="e.g. 50 123 4567 or +971 50 123 4567"
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Must include international country code (e.g. <span className="font-mono font-semibold">+971</span> for UAE, <span className="font-mono font-semibold">+63</span> for Philippines).
                  </p>
                </div>

                {/* Dispatch History List in Modal */}
                {waHistory && waHistory.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-foreground text-xs">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Dispatch History ({waHistory.length})
                      </span>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1.5 divide-y divide-border/40">
                      {waHistory.map((h, idx) => {
                        const hStatus = (h.status || 'submitted').toLowerCase();
                        let badgeColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
                        let label = 'Submitted';
                        if (hStatus === 'read') {
                          badgeColor = 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
                          label = 'Read';
                        } else if (hStatus === 'delivered') {
                          badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                          label = 'Delivered';
                        } else if (hStatus === 'unknown') {
                          badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                          label = 'Unknown';
                        } else if (hStatus === 'failed') {
                          badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
                          label = 'Failed';
                        }

                        return (
                          <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="font-mono font-medium text-foreground">
                                {h.recipient || (h.number ? (h.number.startsWith('+') ? h.number : `+${h.number}`) : '—')}
                              </span>
                              <span className="text-muted-foreground ml-2">{formatDate(h.attempt_time || h.sent_at)}</span>
                              {h.message_id && (
                                <span className="text-[10px] text-muted-foreground font-mono ml-1.5">[{h.message_id.slice(-6)}]</span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badgeColor}`}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Gateway Connection Status Pill */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <span>
                    Gateway status: {gatewayChecking ? 'Checking…' : (gatewayStatus?.loggedIn ? (
                      <span className="text-emerald-600 font-semibold">Connected</span>
                    ) : (
                      <span className="text-amber-600 font-semibold">Needs Pairing (LoggedIn: false)</span>
                    ))}
                  </span>
                  <span className="font-mono text-[10px]">
                    Sender: {gatewayStatus?.senderNumber || '+639562441681'}
                  </span>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={waSending}
                    onClick={() => setWaModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      waSending ||
                      !phoneCheck.isValid ||
                      (isAlreadySent && !waConfirmResend)
                    }
                    onClick={handleSendWhatsAppInvoice}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {waSending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending PDF to WhatsApp…
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5" />
                        Send invoice on WhatsApp
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}