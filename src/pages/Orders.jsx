import { db, formatWhatsAppNumber, onDbUpdate } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate, daysUntil } from '@/lib/mehar-utils';
import { exportOrdersPdf, downloadOrderBill } from '@/lib/pdf-utils';
import {
  Plus, Search, Download, ClipboardList, ArrowLeft,
  MessageCircle, AlertTriangle, Loader2, Clock, Eye, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const STATUSES = ['Booked', 'Cutting', 'Assigned', 'Stitching', 'Quality Check', 'Trial', 'Alteration', 'Ready', 'Delivered', 'Cancelled'];

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

export default function Orders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('All');

  // WhatsApp Modal State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waOrder, setWaOrder] = useState(null);
  const [waPhone, setWaPhone] = useState('');
  const [waCountryCode, setWaCountryCode] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waConfirmResend, setWaConfirmResend] = useState(false);
  const [waHistory, setWaHistory] = useState([]);
  const [waIdempotencyKey, setWaIdempotencyKey] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [gatewayChecking, setGatewayChecking] = useState(false);
  const [downloadingBill, setDownloadingBill] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
    const unsubscribe = onDbUpdate(['Order', 'Customer', 'Payment'], () => {
      loadOrders();
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setTimeout(() => setRefreshing(false), 400);
    toast({
      title: 'Orders Refreshed',
      description: 'Loaded latest order and customer data from database.'
    });
  };

  useEffect(() => {
    const qParam = params.get('q');
    if (qParam !== null) {
      setSearch(qParam);
    }
  }, [params]);

  useEffect(() => {
    if (params.get('new') === '1') {
      const custId = params.get('customer');
      navigate(custId ? `/orders/new?customer=${custId}` : '/orders/new', { replace: true });
    }
  }, [params, navigate]);

  const loadOrders = async () => {
    try {
      const [orderList, custList] = await Promise.all([
        db.entities.Order.list('-created_date', 200),
        db.entities.Customer.list('-created_date', 100)
      ]);
      setOrders(orderList || []);
      setCustomers(custList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsAppModal = async (orderItem) => {
    const cust = customers.find((c) => c.id === orderItem.customer_id);
    const initialPhone = orderItem.sent_to_number || orderItem.customer_phone || cust?.phone || cust?.whatsapp || '';

    let detectedCountry = '';
    const cleanDigits = initialPhone.replace(/[^0-9]/g, '');
    for (const c of COUNTRY_CODES) {
      if (cleanDigits.startsWith(c.code)) {
        detectedCountry = c.code;
        break;
      }
    }

    setWaOrder(orderItem);
    setWaPhone(initialPhone);
    setWaCountryCode(detectedCountry);
    setWaConfirmResend(false);
    setWaIdempotencyKey(`idem-order-${orderItem.id}-${Date.now()}`);
    setWaModalOpen(true);

    try {
      setGatewayChecking(true);
      const [statusRes, histRes] = await Promise.all([
        fetch('/api/invoices/whatsapp-status'),
        fetch(`/api/invoices/whatsapp-history?invoice_id=${orderItem.id}`)
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
    if (!waOrder) return;
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
    const idempotencyKey = waIdempotencyKey || `idem-order-${waOrder.id}-${Date.now()}`;

    try {
      const res = await db.functions.invoke('sendWhatsAppInvoice', {
        order_id: waOrder.id,
        idempotency_key: idempotencyKey,
        phone: check.formatted,
        preview_recipient: check.formatted,
        confirm_resend: waConfirmResend,
        country_code: waCountryCode
      });

      if (res.success) {
        toast({
          title: 'Invoice Submitted to WhatsApp Gateway',
          description: `Order ${waOrder.order_id || waOrder.id} submitted for dispatch to +${res.formatted_number || check.formatted} (Status: Submitted).`
        });
        setWaModalOpen(false);
        await loadOrders();
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
        await loadOrders();
      } else {
        toast({
          title: 'WhatsApp Dispatch Failed',
          description: res.error || 'Failed to dispatch invoice via gateway',
          variant: 'destructive'
        });
        await loadOrders();
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

  const handleDownloadPdf = async (orderItem) => {
    setDownloadingBill(orderItem.id);
    try {
      const cust = customers.find((c) => c.id === orderItem.customer_id);
      await downloadOrderBill(orderItem, [], cust);
      toast({ title: 'PDF Invoice Downloaded', description: `Saved as invoice-${orderItem.order_id || orderItem.id}.pdf` });
    } catch (e) {
      toast({ title: 'PDF generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingBill(null);
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
            <p className="text-sm text-muted-foreground">{orders.length} total orders — view bills & send tax invoices on WhatsApp</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => exportOrdersPdf(filtered)}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link to="/orders/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New Order
            </Button>
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
          {['All', ...STATUSES.slice(0, 5)].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
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
                  <th className="px-4 py-3 text-center font-medium">WhatsApp Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
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
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link to={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                          {o.order_id || o.id.slice(-6)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {o.sent_to_number ? `+${o.sent_to_number}` : (o.customer_phone || '—')}
                        </p>
                      </td>
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

                      {/* WhatsApp Status Badge */}
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const status = (o.whatsapp_status || (o.bill_sent_whatsapp ? 'submitted' : 'pending')).toLowerCase();
                          let badgeClass = 'bg-muted text-muted-foreground border-border';
                          let label = 'Not Sent';
                          if (status === 'read') {
                            badgeClass = 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 dark:border-sky-800';
                            label = 'Read';
                          } else if (status === 'delivered') {
                            badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
                            label = 'Delivered';
                          } else if (status === 'submitted' || status === 'sent') {
                            badgeClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
                            label = 'Submitted';
                          } else if (status === 'unknown') {
                            badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800';
                            label = 'Unknown';
                          } else if (status === 'failed') {
                            badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800';
                            label = 'Failed';
                          }

                          return (
                            <div>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${badgeClass}`}>
                                <MessageCircle className="h-3 w-3" />
                                {label}
                              </span>
                              {o.sent_to_number && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  +{o.sent_to_number}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWhatsAppModal(o)}
                            className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-emerald-300 dark:border-emerald-800"
                            title="Send invoice via WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Send on WhatsApp
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPdf(o)}
                            disabled={downloadingBill === o.id}
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title="Download PDF Invoice"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>

                          <Link to={`/orders/${o.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="View Order Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP: Send Invoice on WhatsApp Modal for Orders */}
      <Dialog open={waModalOpen} onOpenChange={(open) => { if (!open) setWaModalOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Send invoice on WhatsApp
            </DialogTitle>
          </DialogHeader>

          {waOrder && (() => {
            const phoneCheck = formatWhatsAppNumber(waPhone, waCountryCode);
            const isAlreadySent = waOrder.whatsapp_status === 'pending' || waOrder.whatsapp_status === 'submitted' || waOrder.whatsapp_status === 'sent' || waOrder.whatsapp_status === 'delivered' || waOrder.whatsapp_status === 'unknown' || waOrder.bill_sent_whatsapp || (waHistory && waHistory.length > 0);

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
                    PDF Attachment: <span className="font-mono text-foreground font-medium">invoice-{waOrder.order_id || waOrder.id}.pdf</span>
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
                          Active Dispatch Record Exists ({waOrder.sent_at ? formatDate(waOrder.sent_at) : 'Submitted'})
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
                      value={waOrder.customer_name || 'Customer'}
                      readOnly
                      disabled
                      className="mt-1 h-8 text-xs font-semibold bg-background cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Order ID & Total (read only)</Label>
                    <Input
                      value={`${waOrder.order_id || waOrder.id} • ${formatCurrency(waOrder.total_amount)}`}
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
                <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border">
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
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}