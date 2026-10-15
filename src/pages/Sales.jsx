import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, normalizePhoneNumber, formatWhatsAppNumber, onDbUpdate } from '@/api/base44Client';

import { formatCurrency, formatDate } from '@/lib/mehar-utils';
import { generateSaleInvoicePdf, downloadSaleBill } from '@/lib/pdf-utils';
import {
  ShoppingBag, Plus, Minus, Trash2, Send, Search, Package, Receipt,
  MessageCircle, CheckCircle2, Download, RefreshCw,
  Eye, AlertTriangle, Clock, CheckSquare, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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

export default function Sales() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState({ id: '', name: '', phone: '', email: '', address: '' });
  const [pricing, setPricing] = useState({ discount: 0, tax_percent: 5, amount_paid: '', payment_method: 'Cash' });
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingBill, setSendingBill] = useState(null);
  const [downloadingBill, setDownloadingBill] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);

  // Send on WhatsApp Modal State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waSale, setWaSale] = useState(null);
  const [waPhone, setWaPhone] = useState('');
  const [waCountryCode, setWaCountryCode] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waSaveToCustomer, setWaSaveToCustomer] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waConfirmResend, setWaConfirmResend] = useState(false);
  const [waHistory, setWaHistory] = useState([]);
  const [waIdempotencyKey, setWaIdempotencyKey] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [gatewayChecking, setGatewayChecking] = useState(false);

  // Invoice Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailSale, setDetailSale] = useState(null);

  // Bulk Selection State
  const [selectedSales, setSelectedSales] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  // Quick Add Product Dialog
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState({ name: '', price: '', category: 'Fabrics', sku: '' });

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
    const unsubscribe = onDbUpdate(['Product', 'Customer', 'Sale'], () => {
      load();
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 400);
    toast({
      title: 'POS Refreshed',
      description: 'Products catalog, inventory, and customer lists updated.'
    });
  };

  const load = async () => {
    try {
      const [p, c, s] = await Promise.all([
        db.entities.Product.filter({ is_active: true }, '-created_date', 100),
        db.entities.Customer.list('-created_date', 50),
        db.entities.Sale.list('-created_date', 30),
      ]);
      setProducts(p || []);
      setCustomers(c || []);
      setSales(s || []);
      const preCustomer = searchParams.get('customer');
      if (preCustomer) selectCustomer(preCustomer, c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  const addToCart = (p) => {
    setCart((c) => {
      const ex = c.find((i) => i.product_id === p.id);
      if (ex) return c.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  };

  const changeQty = (id, delta) => setCart((c) => c.map((i) => i.product_id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  const removeItem = (id) => setCart((c) => c.filter((i) => i.product_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const afterDiscount = Math.max(0, subtotal - (pricing.discount || 0));
  const taxAmount = afterDiscount * (pricing.tax_percent || 0) / 100;
  const total = afterDiscount + taxAmount;
  const effectivePaid = pricing.amount_paid !== '' && pricing.amount_paid !== null && !isNaN(pricing.amount_paid)
    ? Number(pricing.amount_paid)
    : total;
  const balance = Math.max(0, total - effectivePaid);

  const selectCustomer = (id, list) => {
    const src = list || customers;
    if (!id) { setCustomer({ id: '', name: '', phone: '', email: '', address: '' }); return; }
    const c = src.find((x) => x.id === id);
    if (!c) return;
    setCustomer({
      id: c.id,
      name: c.name,
      phone: c.phone || c.whatsapp || '',
      email: c.email || '',
      address: c.address || c.city || ''
    });
  };

  // Complete Sale, Auto-generate PDF & Optional WhatsApp Invoice
  const generateBill = async () => {
    if (cart.length === 0) {
      toast({ title: 'Add at least one product to the cart', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const saleId = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const rawPhone = customer.phone?.trim() || '';
      const normPhone = rawPhone ? normalizePhoneNumber(rawPhone) : '';
      const shouldDispatchWa = sendWhatsApp && Boolean(normPhone);

      const items = cart.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        line_total: i.price * i.quantity
      }));

      const paidAmount = pricing.amount_paid !== '' && pricing.amount_paid !== null && !isNaN(pricing.amount_paid)
        ? Math.max(0, Number(pricing.amount_paid))
        : total;
      const balanceDue = Math.max(0, total - paidAmount);
      const paymentStatus = paidAmount >= total ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending');

      const saleDraft = {
        sale_id: saleId,
        customer_id: customer.id || undefined,
        customer_name: customer.name?.trim() || 'Walk-in Customer',
        customer_phone: rawPhone || '',
        customer_email: customer.email?.trim() || '',
        items,
        subtotal,
        discount: pricing.discount || 0,
        tax_percent: pricing.tax_percent || 0,
        tax_amount: taxAmount,
        total,
        amount_paid: paidAmount,
        balance_due: balanceDue,
        payment_method: pricing.payment_method,
        payment_status: paymentStatus,
        date: new Date().toISOString().slice(0, 10),
        status: 'Completed',
        bill_sent_whatsapp: false,
      };

      // 1. Generate clean official PDF invoice
      const pdfResult = await generateSaleInvoicePdf(saleDraft, customer, false);
      saleDraft.pdf_url = pdfResult.dataUri;

      // 2. Save record to persistent DB
      const createdSale = await db.entities.Sale.create(saleDraft);

      // 3. Record payment in Payment entity so Payments and Accounts stay in sync
      if (paidAmount > 0) {
        try {
          await db.entities.Payment.create({
            order_id: createdSale.id,
            order_ref: saleId,
            customer_id: customer.id || undefined,
            customer_name: saleDraft.customer_name,
            amount: paidAmount,
            payment_method: pricing.payment_method,
            date: saleDraft.date,
            reference_number: `POS-${saleId}`,
            notes: `Retail POS Sale: ${saleId}`,
            type: 'payment',
          });
        } catch (payErr) {
          console.warn('Payment record sync note:', payErr);
        }
      }

      // 4. Update customer stats if linked
      if (customer.id) {
        try {
          const cust = customers.find((c) => c.id === customer.id);
          if (cust) {
            await db.entities.Customer.update(customer.id, {
              total_orders: (cust.total_orders || 0) + 1,
              total_spent: (cust.total_spent || 0) + total,
            });
          }
        } catch (_) {}
      }

      // 5. Manual sending first: do not automatically send invoices on creation
      // User can click "Send on WhatsApp" action manually per requirement
      let waResult = null;

      // 6. Pre-build Direct WhatsApp link
      const encodedMsg = encodeURIComponent(
        `Dear ${saleDraft.customer_name},\n` +
        `Thank you for your purchase at THREDO!\n\n` +
        `🧾 Invoice No: ${saleId}\n` +
        `💰 Grand Total: AED ${total.toFixed(2)}\n` +
        `💳 Amount Paid: AED ${paidAmount.toFixed(2)}\n` +
        (balanceDue > 0 ? `⚠️ Balance Due: AED ${balanceDue.toFixed(2)}\n` : '') +
        `Payment Method: ${pricing.payment_method}\n\n` +
        `Your official tax invoice has been generated. Thank you for choosing THREDO!`
      );
      const directWaUrl = normPhone ? `https://wa.me/${normPhone}?text=${encodedMsg}` : '';

      setCheckoutSuccess({
        sale: createdSale,
        billNo: saleId,
        method: pricing.payment_method,
        amount: paidAmount,
        total,
        customerName: saleDraft.customer_name,
        phone: rawPhone || 'Walk-in (No Phone)',
        normPhone,
        waUrl: waResult?.whatsapp?.url || directWaUrl,
        waStatus: waResult?.whatsapp?.ok ? 'sent' : (normPhone ? 'ready' : 'unconfigured'),
        pdfDownload: () => pdfResult.download(),
      });

      // Reset cart and customer form
      setCart([]);
      setCustomer({ id: '', name: '', phone: '', email: '', address: '' });
      setPricing({ discount: 0, tax_percent: 5, amount_paid: '', payment_method: 'Cash' });
      load();

      toast({
        title: 'Sale Completed Successfully',
        description: `Invoice ${saleId} recorded for AED ${total.toFixed(2)}.`
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to complete sale', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Open the "Send Invoice on WhatsApp" Popup
  const openWhatsAppModal = async (s) => {
    const custName = s.customer_name || 'Customer';
    const invNo = s.sale_id || (s.id ? `INV-${s.id.slice(-6).toUpperCase()}` : 'INV-0001');
    const custObj = customers.find((c) => c.id === s.customer_id);
    const initialPhone = s.sent_to_number || s.customer_phone || custObj?.phone || custObj?.whatsapp || '';

    // Detect country code from phone; do not silently assume any country if missing
    let detectedCountry = '';
    const cleanDigits = initialPhone.replace(/[^0-9]/g, '');
    for (const c of COUNTRY_CODES) {
      if (cleanDigits.startsWith(c.code)) {
        detectedCountry = c.code;
        break;
      }
    }

    setWaSale(s);
    setWaPhone(initialPhone);
    setWaCountryCode(detectedCountry);
    setWaMessage(`Hello ${custName}, here is your Thredo invoice ${invNo}. Thank you.`);
    setWaSaveToCustomer(false);
    setWaConfirmResend(false);
    setWaIdempotencyKey(`idem-${s.id}-${Date.now()}`);
    setWaModalOpen(true);

    // Live Gateway status check & send history retrieval
    try {
      setGatewayChecking(true);
      const [statusRes, histRes] = await Promise.all([
        fetch('/api/invoices/whatsapp-status'),
        fetch(`/api/invoices/whatsapp-history?invoice_id=${s.id}`)
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

  // Execute Sending from the Popup
  const handleSendWhatsApp = async () => {
    if (!waSale) return;
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
    const idempotencyKey = waIdempotencyKey || `idem-${waSale.id}-${Date.now()}`;

    try {
      const res = await db.functions.invoke('sendSaleBill', {
        sale_id: waSale.id,
        idempotency_key: idempotencyKey,
        phone: check.formatted,
        preview_recipient: check.formatted,
        confirm_resend: waConfirmResend,
        country_code: waCountryCode,
        custom_message: waMessage,
        update_customer_phone: waSaveToCustomer
      });

      if (res.success) {
        toast({
          title: 'Invoice Submitted to WhatsApp Gateway',
          description: `Invoice ${waSale.sale_id} submitted for dispatch to +${res.formatted_number || check.formatted} (Status: Submitted).`
        });
        setWaModalOpen(false);
        await load();
        if (detailSale && detailSale.id === waSale.id && res.sale) {
          setDetailSale(res.sale);
        }
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
          description: res.error || 'Failed to dispatch invoice via gateway',
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

  // Open Invoice Detail Modal
  const openInvoiceDetail = (s) => {
    setDetailSale(s);
    setDetailModalOpen(true);
  };

  // Bulk Selection Handlers
  const toggleSelectSale = (id) => {
    setSelectedSales((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSales.length === sales.length && sales.length > 0) {
      setSelectedSales([]);
    } else {
      setSelectedSales(sales.map((s) => s.id));
    }
  };

  const handleBulkSendWhatsApp = async () => {
    if (selectedSales.length === 0) return;
    setBulkSending(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedSales.length; i++) {
      const saleId = selectedSales[i];
      const targetSale = sales.find((s) => s.id === saleId);
      setBulkProgress(`Sending ${i + 1} of ${selectedSales.length} (${targetSale?.sale_id || ''})...`);
      try {
        const res = await db.functions.invoke('sendSaleBill', { sale_id: saleId });
        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setBulkSending(false);
    setBulkProgress('');
    setSelectedSales([]);
    await load();

    toast({
      title: 'Bulk WhatsApp Send Completed',
      description: `Sent: ${successCount} invoices, Failed/Skipped: ${failCount}`
    });
  };

  // Download PDF Invoice directly
  const handleDownloadPdf = async (s) => {
    setDownloadingBill(s.id);
    try {
      await downloadSaleBill(s);
      toast({ title: 'PDF Invoice Downloaded', description: `Saved as invoice-${s.sale_id}.pdf` });
    } catch (e) {
      toast({ title: 'PDF generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingBill(null);
    }
  };

  // Quick Add Product Handler
  const handleQuickAddProduct = async () => {
    if (!quickProduct.name || !quickProduct.price) {
      toast({ title: 'Name and price are required', variant: 'destructive' });
      return;
    }
    try {
      const p = await db.entities.Product.create({
        name: quickProduct.name.trim(),
        price: parseFloat(quickProduct.price) || 0,
        category: quickProduct.category || 'Fabrics',
        sku: quickProduct.sku.trim() || `PROD-${Math.floor(Math.random() * 9000) + 1000}`,
        is_active: true,
        stock: 50,
        unit: 'piece'
      });
      setQuickAddOpen(false);
      setQuickProduct({ name: '', price: '', category: 'Fabrics', sku: '' });
      addToCart(p);
      load();
      toast({ title: 'Product added & added to cart' });
    } catch (e) {
      toast({ title: 'Failed to add product', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Panel</h1>
          <p className="text-sm text-muted-foreground">Point of Sale (POS) — build bills, generate tax invoices & send via WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" className="gap-2" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={() => setQuickAddOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Quick Add Product
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Product Catalog Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <Package className="mb-2 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Add items to start selling</p>
              <Button size="sm" onClick={() => setQuickAddOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add First Product
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="group flex flex-col rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-sm">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-tight group-hover:text-primary transition-colors">{p.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground font-mono">{p.sku || p.category}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <p className="font-bold text-primary">{formatCurrency(p.price)}</p>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+{p.unit || 'unit'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart & Checkout Panel */}
        <div className="lg:col-span-2">
          <div className="card-shadow sticky top-4 rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Receipt className="h-4 w-4 text-primary" /> Current Bill
            </h3>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p>Tap a product on the left to add it to the bill.</p>
              </div>
            ) : (
              <div className="mb-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {cart.map((i) => (
                  <div key={i.product_id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(i.price)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(i.product_id, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-medium">{i.quantity}</span>
                      <button onClick={() => changeQty(i.product_id, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-16 text-right font-semibold">{formatCurrency(i.price * i.quantity)}</span>
                    <button onClick={() => removeItem(i.product_id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="space-y-3 border-t border-border pt-3">
                {/* Customer Selector */}
                <div>
                  <Label className="text-xs font-medium">Select Registered Customer</Label>
                  <Select value={customer.id} onValueChange={selectCustomer}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Walk-in or select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium">Customer Name</Label>
                    <Input
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      className="mt-1 h-8 text-xs"
                      placeholder="Walk-in"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Phone (WhatsApp) <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="mt-1 h-8 text-xs font-mono"
                      placeholder="+971 50... (optional for walk-in)"
                    />
                  </div>
                </div>

                {/* Pricing & Adjustments */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium">Discount (AED)</Label>
                    <Input
                      type="number"
                      value={pricing.discount}
                      onChange={(e) => setPricing({ ...pricing, discount: parseFloat(e.target.value) || 0 })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">VAT Tax %</Label>
                    <Input
                      type="number"
                      value={pricing.tax_percent}
                      onChange={(e) => setPricing({ ...pricing, tax_percent: parseFloat(e.target.value) || 0 })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Amount Paid (AED)</Label>
                      <div className="flex gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPricing({ ...pricing, amount_paid: total })}
                          className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold hover:bg-emerald-200"
                        >
                          Full
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricing({ ...pricing, amount_paid: parseFloat((total / 2).toFixed(2)) })}
                          className="rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold hover:bg-amber-200"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricing({ ...pricing, amount_paid: 0 })}
                          className="rounded px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold hover:bg-rose-200"
                        >
                          0
                        </button>
                      </div>
                    </div>
                    <Input
                      type="number"
                      placeholder={total.toFixed(2)}
                      value={pricing.amount_paid}
                      onChange={(e) => setPricing({ ...pricing, amount_paid: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                      className="mt-1 h-8 text-xs font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Payment Method</Label>
                    <Select value={pricing.payment_method} onValueChange={(v) => setPricing({ ...pricing, payment_method: v })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="UPI">UPI / Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calculation Summary */}
                <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {pricing.discount > 0 && <div className="flex justify-between text-amber-600"><span>Discount</span><span>-{formatCurrency(pricing.discount)}</span></div>}
                  <div className="flex justify-between text-muted-foreground"><span>VAT ({pricing.tax_percent}%)</span><span>+{formatCurrency(taxAmount)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1 font-bold text-sm text-foreground">
                    <span>Total Amount</span>
                    <span className="text-primary font-extrabold">{formatCurrency(total)}</span>
                  </div>
                  {pricing.amount_paid > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Paid</span>
                      <span>-{formatCurrency(pricing.amount_paid)}</span>
                    </div>
                  )}
                  {balance > 0 && (
                    <div className="flex justify-between font-semibold text-amber-600">
                      <span>Balance Due</span>
                      <span>{formatCurrency(balance)}</span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={generateBill}
                  disabled={generating || cart.length === 0}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 shadow-md"
                >
                  {generating ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating Invoice & PDF...</>
                  ) : (
                    <><Receipt className="h-4 w-4" /> Complete Sale & Generate Invoice</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales Table with Bulk Selection, WhatsApp Modal & PDF Download */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-lg">
              <Receipt className="h-5 w-5 text-primary" /> Recent Sales History
            </h3>
            <span className="text-xs text-muted-foreground">{sales.length} transactions recorded</span>
          </div>

          {/* Bulk Action Controls */}
          {sales.length > 0 && (
            <div className="flex items-center gap-2">
              {selectedSales.length > 0 ? (
                <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border border-border text-xs">
                  <span className="font-medium text-foreground">
                    {selectedSales.length} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={handleBulkSendWhatsApp}
                    disabled={bulkSending}
                    className="h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    {bulkSending ? (
                      <><RefreshCw className="h-3 w-3 animate-spin" /> {bulkProgress || 'Sending...'}</>
                    ) : (
                      <><MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp ({selectedSales.length})</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSales([])}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    Deselect
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleSelectAll}
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Select All for Bulk Send
                </Button>
              )}
            </div>
          )}
        </div>

        {sales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sales recorded yet. Process your first sale above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedSales.length === sales.length && sales.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      title="Select All"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-medium">Invoice No</th>
                  <th className="py-2.5 px-3 font-medium">Customer</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium">Items</th>
                  <th className="py-2.5 px-3 font-medium">Payment</th>
                  <th className="py-2.5 px-3 font-medium text-right">Total</th>
                  <th className="py-2.5 px-3 text-center font-medium">WhatsApp Status</th>
                  <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const isSelected = selectedSales.includes(s.id);
                  const isSent = s.whatsapp_status === 'sent' || s.bill_sent_whatsapp;
                  const isFailed = s.whatsapp_status === 'failed';

                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectSale(s.id)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-primary">
                        <button
                          onClick={() => openInvoiceDetail(s)}
                          className="hover:underline text-left font-mono"
                          title="Click to view full invoice"
                        >
                          {s.sale_id}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-foreground">{s.customer_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {s.sent_to_number ? `+${s.sent_to_number}` : (s.customer_phone || '—')}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{formatDate(s.date)}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{(s.items || []).length} items</td>
                      <td className="py-3 px-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                          s.payment_status === 'Partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}>
                          {s.payment_status} ({s.payment_method || 'Cash'})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-foreground">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {(() => {
                          const status = (s.whatsapp_status || (s.bill_sent_whatsapp ? 'submitted' : 'pending')).toLowerCase();
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
                              {s.sent_to_number && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  +{s.sent_to_number}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send on WhatsApp Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWhatsAppModal(s)}
                            className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-emerald-300 dark:border-emerald-800"
                            title="Send invoice via WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Send on WhatsApp
                          </Button>

                          {/* Direct PDF Download Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPdf(s)}
                            disabled={downloadingBill === s.id}
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title="Download PDF Invoice"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>

                          {/* View Invoice Detail Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openInvoiceDetail(s)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="View Invoice Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP: Send Invoice on WhatsApp Modal */}
      <Dialog open={waModalOpen} onOpenChange={(open) => { if (!open) setWaModalOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Send Invoice on WhatsApp
            </DialogTitle>
          </DialogHeader>

          {waSale && (() => {
            const phoneCheck = formatWhatsAppNumber(waPhone, waCountryCode);
            const isAlreadySent = waSale.whatsapp_status === 'pending' || waSale.whatsapp_status === 'submitted' || waSale.whatsapp_status === 'sent' || waSale.whatsapp_status === 'delivered' || waSale.whatsapp_status === 'unknown' || waSale.bill_sent_whatsapp || (waHistory && waHistory.length > 0);

            return (
              <div className="space-y-4 py-2">
                {/* Prominently Show Destination Number Before Sending */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      Destination Recipient
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      Invoice Attachment Target
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
                    PDF Attachment: <span className="font-mono text-foreground font-medium">invoice-{waSale.sale_id}.pdf</span>
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
                          Active Dispatch Record Exists ({waSale.sent_at ? formatDate(waSale.sent_at) : 'Submitted'})
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

                {/* Read-Only Invoice Summary */}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-xs">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Customer Name (read only)</Label>
                    <Input
                      value={waSale.customer_name || 'Walk-in Customer'}
                      readOnly
                      disabled
                      className="mt-1 h-8 text-xs font-semibold bg-background cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Invoice No & Total (read only)</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        value={waSale.sale_id}
                        readOnly
                        disabled
                        className="h-8 text-xs font-mono font-bold text-primary bg-background cursor-not-allowed flex-1"
                      />
                      <span className="font-bold text-emerald-600 shrink-0 text-sm">
                        {formatCurrency(waSale.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phone Number & Country Code Selector */}
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs font-medium">Country Code</Label>
                      <Select value={waCountryCode} onValueChange={setWaCountryCode}>
                        <SelectTrigger className="mt-1 h-9 text-xs">
                          <SelectValue placeholder="Select Code" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.flag} {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs font-medium">Customer Phone Number *</Label>
                      <Input
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value)}
                        placeholder="e.g. +971 50 123 4567 or +63 956 244 1681"
                        className="mt-1 h-9 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>

                  {/* Real-time Formatted Number Preview & Validation Feedback */}
                  <div className="rounded-lg bg-muted/50 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[11px]">Validated Destination (with Country Code):</span>
                      <span className={`font-mono font-bold ${
                        phoneCheck.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      }`}>
                        {phoneCheck.formatted ? `+${phoneCheck.formatted}` : '—'}
                      </span>
                    </div>

                    {phoneCheck.formatted ? (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Length: {phoneCheck.formatted.length} digits (E.164 rule: 8 to 15 digits)</span>
                        <span className={phoneCheck.isValid ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                          {phoneCheck.isValid ? '✓ Country code present' : '✗ Invalid length'}
                        </span>
                      </div>
                    ) : null}

                    {/* Red Error Message if Invalid */}
                    {!phoneCheck.isValid && waPhone.trim() ? (
                      <p className="text-xs font-semibold text-destructive mt-1">
                        {phoneCheck.error || 'Please enter a valid WhatsApp number with country code'}
                      </p>
                    ) : null}
                  </div>

                  {/* Save to customer record checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-medium text-foreground select-none">
                    <input
                      type="checkbox"
                      checked={waSaveToCustomer}
                      onChange={(e) => setWaSaveToCustomer(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                    />
                    Save this verified number to customer record
                  </label>
                </div>

                {/* Optional Message Box */}
                <div>
                  <Label className="text-xs font-medium">Message Caption</Label>
                  <textarea
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Hello [customer name], here is your Thredo invoice [invoice number]..."
                  />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Attached document: <span className="font-mono">invoice-{waSale.sale_id}.pdf</span> (generated server-side)
                  </p>
                </div>

                {/* Sent History List in Modal */}
                {waSale.whatsapp_history && waSale.whatsapp_history.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-foreground text-xs">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Dispatch History ({waSale.whatsapp_history.length})
                      </span>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1.5 divide-y divide-border/40">
                      {waSale.whatsapp_history.map((h, idx) => {
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
                                {h.number ? (h.number.startsWith('+') ? h.number : `+${h.number}`) : '—'}
                              </span>
                              <span className="text-muted-foreground ml-2">{formatDate(h.sent_at)}</span>
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
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleDownloadPdf(waSale)}
              disabled={downloadingBill === waSale?.id}
              className="gap-1.5 text-xs mr-auto"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Download PDF
            </Button>
            <Button
              variant="ghost"
              onClick={() => setWaModalOpen(false)}
              disabled={waSending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={
                !waSale ||
                !formatWhatsAppNumber(waPhone, waCountryCode).isValid ||
                waSending ||
                (isAlreadySent && !waConfirmResend)
              }
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
            >
              {waSending ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Submitting to WhatsApp...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Send Invoice on WhatsApp</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Invoice Detail Page / Modal */}
      <Dialog open={detailModalOpen} onOpenChange={(open) => { if (!open) setDetailModalOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-4">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Detail — {detailSale?.sale_id}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                detailSale?.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}>
                {detailSale?.payment_status}
              </span>
            </DialogTitle>
          </DialogHeader>

          {detailSale && (
            <div className="space-y-4 py-2 text-sm">
              {/* Customer & Meta Box */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4 text-xs">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{detailSale.customer_name}</h4>
                  <p className="text-muted-foreground mt-1 font-mono">
                    Phone: {detailSale.customer_phone || '—'}
                  </p>
                  {detailSale.customer_email && (
                    <p className="text-muted-foreground">Email: {detailSale.customer_email}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Date: {formatDate(detailSale.date)}</p>
                  <p className="text-muted-foreground">Payment Method: {detailSale.payment_method || 'Cash'}</p>
                  <p className="mt-1 font-mono font-bold text-primary text-sm">
                    {detailSale.sale_id}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Purchased Items</h4>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-left">Item</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(detailSale.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-medium">{it.name}</td>
                          <td className="py-2 px-3 text-center">{it.quantity}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(it.price)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(it.line_total || it.price * it.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1 rounded-lg bg-muted/40 p-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(detailSale.subtotal || detailSale.total)}</span>
                  </div>
                  {detailSale.discount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(detailSale.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>VAT ({detailSale.tax_percent || 5}%)</span>
                    <span>+{formatCurrency(detailSale.tax_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 font-bold text-sm text-foreground">
                    <span>Grand Total</span>
                    <span className="text-primary font-bold">{formatCurrency(detailSale.total)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Amount Paid</span>
                    <span>{formatCurrency(detailSale.amount_paid || detailSale.total)}</span>
                  </div>
                  {detailSale.balance_due > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>Balance Due</span>
                      <span>{formatCurrency(detailSale.balance_due)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sent History List on Invoice Detail Page */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                <h4 className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  Sent History
                </h4>
                {(!detailSale.whatsapp_history || detailSale.whatsapp_history.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No WhatsApp dispatch history recorded yet.</p>
                ) : (
                  <div className="space-y-1.5 divide-y divide-border/40">
                    {detailSale.whatsapp_history.map((h, idx) => (
                      <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-medium text-foreground">+{h.number}</span>
                          <span className="text-muted-foreground ml-2 text-[11px]">{formatDate(h.sent_at)}</span>
                          {h.error && (
                            <span className="text-destructive text-[11px] ml-2 font-mono">({h.error})</span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          h.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {h.status === 'sent' ? 'Sent' : 'Failed'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleDownloadPdf(detailSale)}
              disabled={downloadingBill === detailSale?.id}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Download PDF
            </Button>
            <Button
              onClick={() => {
                const s = detailSale;
                setDetailModalOpen(false);
                openWhatsAppModal(s);
              }}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Send on WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Confirmation & WhatsApp Modal */}
      <Dialog open={!!checkoutSuccess} onOpenChange={(o) => { if (!o) setCheckoutSuccess(null); }}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 shadow-inner">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Invoice Generated & Saved</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Payment of <span className="font-semibold text-foreground">{formatCurrency(checkoutSuccess?.amount || 0)}</span> recorded via {checkoutSuccess?.method}.
              </p>
            </div>

            <div className="w-full space-y-2 rounded-xl bg-muted/40 p-4 text-sm text-left">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice No:</span>
                <span className="font-mono font-bold text-primary">{checkoutSuccess?.billNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{checkoutSuccess?.customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WhatsApp Number:</span>
                <span className="font-mono font-medium">{checkoutSuccess?.phone}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <span className="text-muted-foreground">Grand Total:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(checkoutSuccess?.total || 0)}</span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2.5 pt-2">
              {/* WhatsApp Launch Button */}
              <Button
                onClick={() => {
                  const s = checkoutSuccess?.sale;
                  setCheckoutSuccess(null);
                  if (s) openWhatsAppModal(s);
                }}
                className="w-full gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-medium"
              >
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </Button>

              {/* Download PDF Button */}
              <Button
                variant="outline"
                onClick={() => checkoutSuccess?.pdfDownload && checkoutSuccess.pdfDownload()}
                className="w-full gap-2 border-primary/30 hover:bg-primary/5"
              >
                <Download className="h-4 w-4 text-primary" /> Download PDF
              </Button>
            </div>

            <Button variant="ghost" onClick={() => setCheckoutSuccess(null)} className="w-full mt-1 text-xs text-muted-foreground">
              Close Window
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Product Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Add Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Product Name *</Label>
              <Input
                value={quickProduct.name}
                onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })}
                placeholder="e.g. Linen Kandora Fabric"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Price (AED) *</Label>
                <Input
                  type="number"
                  value={quickProduct.price}
                  onChange={(e) => setQuickProduct({ ...quickProduct, price: e.target.value })}
                  placeholder="150.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={quickProduct.category} onValueChange={(v) => setQuickProduct({ ...quickProduct, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fabrics">Fabrics</SelectItem>
                    <SelectItem value="Tailoring">Tailoring</SelectItem>
                    <SelectItem value="Ready-to-Wear">Ready-to-Wear</SelectItem>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">SKU / Code (Optional)</Label>
              <Input
                value={quickProduct.sku}
                onChange={(e) => setQuickProduct({ ...quickProduct, sku: e.target.value })}
                placeholder="PROD-001"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickAddProduct} className="bg-primary hover:bg-primary/90">
              Save & Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}