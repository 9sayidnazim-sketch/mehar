import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { formatCurrency } from '@/lib/mehar-utils';
import {
  ArrowLeft, User, Calendar, Ruler, Shirt, Sparkles, DollarSign,
  Truck, Save, X, Plus, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OrderCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' });
  const [creatingCust, setCreatingCust] = useState(false);

  const [form, setForm] = useState({
    customer_id: '', customer_name: '',
    booking_date: new Date().toISOString().slice(0, 10),
    delivery_date: '', priority: 'Normal', order_type: 'Standard',
    template_id: '', template_name: '', measurement_values: {},
    fabric_type: '', fabric_code: '', fabric_quantity: 0, fabric_cost: 0, supplier: '',
    style_notes: '', accessories: '',
    tailor_id: '', tailor_name: '', tailor_rate: 0,
    markup_percent: 30, discount: 0, discount_type: 'percent', tax_percent: 5,
    payment_method: 'Cash', amount_paid: 0, delivery_method: 'Pickup',
    remarks: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [c, t, tl] = await Promise.all([
          db.entities.Customer.list('-created_date', 100),
          db.entities.MeasurementTemplate.filter({ is_active: true }, '-created_date', 50),
          db.entities.Tailor.filter({ active: true }, '-created_date', 50),
        ]);
        setCustomers(c);
        setTemplates(t);
        setTailors(tl);
        const preselectCustomer = params.get('customer');
        if (preselectCustomer) {
          const found = c.find((x) => x.id === preselectCustomer);
          if (found) {
            setForm((f) => ({ ...f, customer_id: found.id, customer_name: found.name }));
          }
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const steps = [
    { n: 1, label: 'Customer', icon: User },
    { n: 2, label: 'Details', icon: Calendar },
    { n: 3, label: 'Measurements', icon: Ruler },
    { n: 4, label: 'Fabric & Style', icon: Shirt },
    { n: 5, label: 'Pricing', icon: DollarSign },
    { n: 6, label: 'Review', icon: Save },
  ];

  const selectedTemplate = templates.find((t) => t.id === form.template_id);

  const calcTotal = () => {
    const fabric = (form.fabric_quantity || 0) * (form.fabric_cost || 0);
    const accessoriesCost = 0;
    const base = fabric + accessoriesCost + (form.tailor_rate || 0);
    const markup = base * (form.markup_percent || 0) / 100;
    const subtotal = base + markup;
    const discountVal = form.discount_type === 'percent'
      ? subtotal * (form.discount || 0) / 100
      : (form.discount || 0);
    const afterDiscount = subtotal - discountVal;
    const tax = afterDiscount * (form.tax_percent || 0) / 100;
    const total = afterDiscount + tax;
    return { fabric, base, markup, subtotal, discountVal, afterDiscount, tax, total };
  };

  const calc = calcTotal();

  const handleQuickCreateCustomer = async () => {
    if (!newCust.name.trim() || !newCust.phone.trim()) return;
    setCreatingCust(true);
    try {
      const created = await db.entities.Customer.create({
        name: newCust.name.trim(),
        phone: newCust.phone.trim(),
        email: newCust.email.trim(),
        notes: 'Created during order setup',
      });
      setCustomers((prev) => [created, ...prev]);
      setForm((f) => ({ ...f, customer_id: created.id, customer_name: created.name }));
      setShowCustomerDialog(false);
      setNewCust({ name: '', phone: '', email: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingCust(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const orderNumber = `THR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const order = await db.entities.Order.create({
        ...form,
        order_id: orderNumber,
        subtotal: calc.subtotal,
        total_amount: calc.total,
        amount_paid: form.amount_paid || 0,
        balance_due: calc.total - (form.amount_paid || 0),
        payment_status: (form.amount_paid || 0) >= calc.total ? 'Paid' : (form.amount_paid || 0) > 0 ? 'Partial' : 'Pending',
        status: 'Booked',
      });

      // Update customer stats
      if (form.customer_id) {
        const cust = customers.find((c) => c.id === form.customer_id);
        if (cust) {
          await db.entities.Customer.update(form.customer_id, {
            total_orders: (cust.total_orders || 0) + 1,
            total_spent: (cust.total_spent || 0) + calc.total,
            outstanding_balance: (cust.outstanding_balance || 0) + (calc.total - (form.amount_paid || 0)),
          });
        }
      }

      // Record advance payment if any
      if (form.amount_paid > 0) {
        await db.entities.Payment.create({
          order_id: order.id,
          order_ref: orderNumber,
          customer_id: form.customer_id,
          customer_name: form.customer_name,
          amount: form.amount_paid,
          payment_method: form.payment_method,
          date: form.booking_date,
          type: 'advance',
        });
      }

      navigate(`/orders/${order.id}`);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return form.customer_id;
    if (step === 2) return form.delivery_date;
    return true;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <button onClick={() => navigate('/orders')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Order</h1>
        <p className="text-sm text-muted-foreground">Fill in the details step by step</p>
      </div>

      {/* Stepper with click-to-slide navigation */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <button
              type="button"
              onClick={() => { if (s.n < step) setStep(s.n); }}
              disabled={s.n > step}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all text-left",
                s.n < step ? "cursor-pointer hover:opacity-80" : s.n === step ? "cursor-default" : "cursor-not-allowed opacity-60"
              )}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                step >= s.n ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className={`text-[11px] font-medium ${step >= s.n ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 rounded-full mx-1 transition-colors ${step > s.n ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="card-shadow rounded-xl border border-border bg-card p-6"
      >
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Select Customer</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setShowCustomerDialog(true)}
              >
                <Plus className="h-4 w-4" /> Add New Customer
              </Button>
            </div>

            {form.customer_id ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-sm font-bold text-white shadow-md">
                    {form.customer_name?.charAt(0)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-sm">{form.customer_name}</span>
                    <p className="text-xs text-muted-foreground">Customer selected for this order</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, customer_id: '', customer_name: '' })}>
                  Change Customer
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customers by name, phone or email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {customers
                    .filter((c) => {
                      const q = customerSearch.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        c.name?.toLowerCase().includes(q) ||
                        c.phone?.toLowerCase().includes(q) ||
                        c.email?.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm({ ...form, customer_id: c.id, customer_name: c.name })}
                        className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
                            {c.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.phone || 'No phone'}</p>
                          </div>
                        </div>
                        <span className="text-xs text-primary font-medium">Select →</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Booking Date</Label>
              <Input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Date *</Label>
              <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Rush">Rush</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Order Type</Label>
              <Select value={form.order_type} onValueChange={(v) => setForm({ ...form, order_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Alteration">Alteration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Assign Tailor (optional)</Label>
              <Select value={form.tailor_id} onValueChange={(v) => {
                const t = tailors.find((x) => x.id === v);
                setForm({ ...form, tailor_id: v, tailor_name: t?.name || '', tailor_rate: t?.rate || 0 });
              }}>
                <SelectTrigger><SelectValue placeholder="Select tailor..." /></SelectTrigger>
                <SelectContent>
                  {tailors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} — {t.specialization}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Measurement Template</h3>
            <Select value={form.template_id} onValueChange={(v) => {
              const t = templates.find((x) => x.id === v);
              const vals = {};
              t?.fields?.forEach((f) => { vals[f.field_name] = f.default_value || ''; });
              setForm({ ...form, template_id: v, template_name: t?.name || '', measurement_values: vals });
            }}>
              <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate?.fields?.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedTemplate.fields.map((f, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">{f.field_name} {f.is_required && '*'}</Label>
                    <Input
                      value={form.measurement_values[f.field_name] || ''}
                      onChange={(e) => setForm({
                        ...form,
                        measurement_values: { ...form.measurement_values, [f.field_name]: e.target.value }
                      })}
                      placeholder={f.unit || 'cm'}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Measurement Notes</Label>
              <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Any special fitting notes..." />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Shirt className="h-4 w-4" /> Fabric Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fabric Type</Label>
                <Input value={form.fabric_type} onChange={(e) => setForm({ ...form, fabric_type: e.target.value })} placeholder="Cotton, Silk..." />
              </div>
              <div className="space-y-1.5">
                <Label>Fabric Code</Label>
                <Input value={form.fabric_code} onChange={(e) => setForm({ ...form, fabric_code: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity (meters)</Label>
                <Input type="number" value={form.fabric_quantity} onChange={(e) => setForm({ ...form, fabric_quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost per meter</Label>
                <Input type="number" value={form.fabric_cost} onChange={(e) => setForm({ ...form, fabric_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Supplier</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-border pt-4">
              <Label>Style Notes & Accessories</Label>
              <Textarea value={form.style_notes} onChange={(e) => setForm({ ...form, style_notes: e.target.value })} placeholder="Collar type, cuff, special instructions..." />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tailor Rate</Label>
                <Input type="number" value={form.tailor_rate} onChange={(e) => setForm({ ...form, tailor_rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Markup %</Label>
                <Input type="number" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Discount</Label>
                <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tax % (GST/VAT)</Label>
                <Input type="number" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Advance Payment</Label>
                <Input type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Method</Label>
                <Select value={form.delivery_method} onValueChange={(v) => setForm({ ...form, delivery_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pickup">Pickup</SelectItem>
                    <SelectItem value="Delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Fabric Cost</span><span>{formatCurrency(calc.fabric)}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Tailor Rate</span><span>{formatCurrency(form.tailor_rate)}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Markup ({form.markup_percent}%)</span><span>+{formatCurrency(calc.markup)}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Discount</span><span>-{formatCurrency(calc.discountVal)}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Tax ({form.tax_percent}%)</span><span>+{formatCurrency(calc.tax)}</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold">
                <span>Total</span><span>{formatCurrency(calc.total)}</span>
              </div>
              {form.amount_paid > 0 && (
                <div className="mt-1 flex justify-between text-emerald-600"><span>Advance Paid</span><span>-{formatCurrency(form.amount_paid)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-amber-600"><span>Balance Due</span><span>{formatCurrency(calc.total - (form.amount_paid || 0))}</span></div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Review & Confirm</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
              <ReviewRow label="Customer" value={form.customer_name} />
              <ReviewRow label="Delivery Date" value={form.delivery_date} />
              <ReviewRow label="Priority" value={form.priority} />
              <ReviewRow label="Template" value={form.template_name || '—'} />
              <ReviewRow label="Fabric" value={form.fabric_type ? `${form.fabric_type} (${form.fabric_quantity}m)` : '—'} />
              <ReviewRow label="Tailor" value={form.tailor_name || 'Unassigned'} />
              <ReviewRow label="Total Amount" value={formatCurrency(calc.total)} highlight />
              <ReviewRow label="Advance" value={formatCurrency(form.amount_paid)} />
              <ReviewRow label="Balance Due" value={formatCurrency(calc.total - (form.amount_paid || 0))} />
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : navigate('/orders')} disabled={saving}>
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 6 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="bg-primary hover:bg-primary/90">
            Continue
          </Button>
        ) : (
          <Button onClick={submit} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Create Order</>}
          </Button>
        )}
      </div>
      {/* Quick Add Customer Modal */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input
                placeholder="e.g. Rashid Al Nuaimi"
                value={newCust.name}
                onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone / WhatsApp *</Label>
              <Input
                placeholder="+971 50 123 4567"
                value={newCust.phone}
                onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email (Optional)</Label>
              <Input
                placeholder="rashid@example.com"
                value={newCust.email}
                onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCustomerDialog(false)}>Cancel</Button>
            <Button
              onClick={handleQuickCreateCustomer}
              disabled={creatingCust || !newCust.name.trim() || !newCust.phone.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {creatingCust ? 'Creating...' : 'Save & Select'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewRow({ label, value, highlight }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${highlight ? 'bg-muted/30 font-semibold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}