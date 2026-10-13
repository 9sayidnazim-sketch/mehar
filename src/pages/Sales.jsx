import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, normalizePhoneNumber } from '@/api/base44Client';

import { formatCurrency, formatDate } from '@/lib/mehar-utils';
import { generateSaleInvoicePdf, downloadSaleBill } from '@/lib/pdf-utils';
import {
  ShoppingBag, Plus, Minus, Trash2, Send, Search, Package, Receipt,
  MessageCircle, CheckCircle2, Download, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
  const [generating, setGenerating] = useState(false);
  const [sendingBill, setSendingBill] = useState(null);
  const [downloadingBill, setDownloadingBill] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);

  // Quick Add Product Dialog
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState({ name: '', price: '', category: 'Fabrics', sku: '' });

  useEffect(() => { load(); }, []);

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

  // Phase 4: Complete Sale, Auto-generate PDF & Dispatch WhatsApp Invoice
  const generateBill = async () => {
    if (cart.length === 0) {
      toast({ title: 'Add at least one product to the cart', variant: 'destructive' });
      return;
    }
    if (!customer.phone) {
      toast({ title: 'Customer phone is required', description: 'Needed to send the invoice via WhatsApp', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const saleId = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const normPhone = normalizePhoneNumber(customer.phone);
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
        customer_name: customer.name || 'Walk-in Customer',
        customer_phone: customer.phone,
        customer_email: customer.email,
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

      // 3. Update customer stats if linked
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

      // 4. Trigger WhatsApp Auto-Dispatch via function invoker
      let waResult = null;
      try {
        waResult = await db.functions.invoke('sendSaleBill', { sale_id: createdSale.id });
      } catch (err) {
        console.warn('Function invoke note:', err);
      }

      // 5. Pre-build Direct WhatsApp link
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
      const directWaUrl = `https://wa.me/${normPhone}?text=${encodedMsg}`;

      setCheckoutSuccess({
        sale: createdSale,
        billNo: saleId,
        method: pricing.payment_method,
        amount: paidAmount,
        total,
        customerName: saleDraft.customer_name,
        phone: customer.phone,
        normPhone,
        waUrl: waResult?.whatsapp?.url || directWaUrl,
        waStatus: waResult?.whatsapp?.ok ? 'sent' : 'ready',
        pdfDownload: () => pdfResult.download(),
      });

      // Reset cart and customer form
      setCart([]);
      setCustomer({ id: '', name: '', phone: '', email: '', address: '' });
      setPricing({ discount: 0, tax_percent: 5, amount_paid: 0, payment_method: 'Cash' });
      load();

      toast({
        title: 'Sale Completed & Invoice Generated',
        description: `Invoice ${saleId} recorded and ready for WhatsApp delivery.`
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to complete sale', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Resend WhatsApp Invoice
  const resendBill = async (s) => {
    setSendingBill(s.id);
    try {
      const res = await db.functions.invoke('sendSaleBill', { sale_id: s.id });
      const normPhone = normalizePhoneNumber(s.customer_phone);
      
      const encodedMsg = encodeURIComponent(
        `Dear ${s.customer_name},\n` +
        `Here is your invoice copy from THREDO:\n\n` +
        `🧾 Invoice No: ${s.sale_id}\n` +
        `💰 Grand Total: AED ${Number(s.total || 0).toFixed(2)}\n` +
        `💳 Paid: AED ${Number(s.amount_paid || 0).toFixed(2)}\n` +
        (s.balance_due > 0 ? `⚠️ Balance Due: AED ${Number(s.balance_due || 0).toFixed(2)}\n` : '') +
        `\nThank you for choosing THREDO!`
      );
      const waUrl = res?.whatsapp?.url || `https://wa.me/${normPhone}?text=${encodedMsg}`;

      // Open WhatsApp chat in new window
      if (typeof window !== 'undefined') {
        window.open(waUrl, '_blank');
      }

      toast({
        title: 'Invoice Sent on WhatsApp',
        description: `Invoice ${s.sale_id} sent to ${s.customer_name} (${normPhone}).`
      });
      load();
    } catch (e) {
      toast({ title: 'WhatsApp send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSendingBill(null);
    }
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
          <p className="text-sm text-muted-foreground">Point of Sale (POS) — build bills, generate tax invoices & auto-send via WhatsApp</p>
        </div>
        <Button onClick={() => setQuickAddOpen(true)} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Quick Add Product
        </Button>
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
                    <Label className="text-xs font-medium">Phone (WhatsApp) *</Label>
                    <Input
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="mt-1 h-8 text-xs font-mono"
                      placeholder="+971 50..."
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
                    <><Send className="h-4 w-4" /> Complete Sale & WhatsApp Invoice</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales Table with WhatsApp Resend & PDF Download */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-lg">
            <Receipt className="h-5 w-5 text-primary" /> Recent Sales History
          </h3>
          <span className="text-xs text-muted-foreground">{sales.length} transactions recorded</span>
        </div>

        {sales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sales recorded yet. Process your first sale above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-xs text-muted-foreground">
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
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-primary">{s.sale_id}</td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-foreground">{s.customer_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.customer_phone || '—'}</p>
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
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.bill_sent_whatsapp
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        <MessageCircle className="h-3 w-3" />
                        {s.bill_sent_whatsapp ? 'Sent' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Phase 4: Resend on WhatsApp Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resendBill(s)}
                          disabled={sendingBill === s.id}
                          className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                        >
                          {sendingBill === s.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                          Resend WA
                        </Button>

                        {/* Direct PDF Download Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadPdf(s)}
                          disabled={downloadingBill === s.id}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Download PDF Invoice"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                asChild
                className="w-full gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-medium"
              >
                <a href={checkoutSuccess?.waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Open in WhatsApp
                </a>
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