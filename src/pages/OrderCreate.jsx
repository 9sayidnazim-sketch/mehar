import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { formatCurrency } from '@/lib/mehar-utils';
import {
  ArrowLeft, User, Calendar, Ruler, Shirt, DollarSign, Save, Plus, Search
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
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', whatsapp: '', address: '' });
  const [creatingCust, setCreatingCust] = useState(false);

  // On-time tailor addition
  const [showTailorDialog, setShowTailorDialog] = useState(false);
  const [newTailor, setNewTailor] = useState({ name: '', phone: '', specialization: 'Master Cutter', rate: '45' });
  const [creatingTailor, setCreatingTailor] = useState(false);

  // On-time custom measurement fields
  const [customMeasurementFields, setCustomMeasurementFields] = useState([]);
  const [showCustomFieldDialog, setShowCustomFieldDialog] = useState(false);
  const [newCustomField, setNewCustomField] = useState({ name: '', unit: 'cm' });

  const [form, setForm] = useState({
    customer_id: '', customer_name: '',
    booking_date: new Date().toISOString().slice(0, 10),
    delivery_date: '', priority: 'Normal', order_type: 'Standard',
    template_id: '', template_name: '', measurement_values: {},
    fabric_type: '', fabric_code: '', fabric_quantity: 0, fabric_cost: 0, supplier: '',
    style_notes: '', accessories: '',
    tailor_id: '', tailor_name: '', tailor_rate: 0,
    extra_charges: 0, extra_charges_note: '',
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

    const handleSync = (e) => {
      const ent = e.detail?.entity;
      if (ent === 'Customer') db.entities.Customer.list('-created_date', 100).then(setCustomers);
      if (ent === 'Tailor') db.entities.Tailor.filter({ active: true }, '-created_date', 50).then(setTailors);
    };
    window.addEventListener('thredo-data-updated', handleSync);
    return () => window.removeEventListener('thredo-data-updated', handleSync);
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
    const extra = form.extra_charges || 0;
    const base = fabric + accessoriesCost + (form.tailor_rate || 0) + extra;
    const markup = base * (form.markup_percent || 0) / 100;
    const subtotal = base + markup;
    const discountVal = form.discount_type === 'percent'
      ? subtotal * (form.discount || 0) / 100
      : (form.discount || 0);
    const afterDiscount = subtotal - discountVal;
    const tax = afterDiscount * (form.tax_percent || 0) / 100;
    const total = afterDiscount + tax;
    return { fabric, base, markup, subtotal, discountVal, afterDiscount, tax, total, extra };
  };

  const calc = calcTotal();

  const handleQuickCreateCustomer = async () => {
    if (!newCust.name.trim() || !newCust.phone.trim()) return;
    setCreatingCust(true);
    try {
      const created = await db.entities.Customer.create({
        name: newCust.name.trim(),
        phone: newCust.phone.trim(),
        whatsapp: newCust.whatsapp.trim() || newCust.phone.trim(),
        email: newCust.email.trim(),
        address: newCust.address.trim(),
        notes: 'Created during order setup',
      });
      setCustomers((prev) => [created, ...prev]);
      setForm((f) => ({ ...f, customer_id: created.id, customer_name: created.name }));
      setShowCustomerDialog(false);
      setNewCust({ name: '', phone: '', email: '', whatsapp: '', address: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingCust(false);
    }
  };

  const handleQuickCreateTailor = async () => {
    if (!newTailor.name.trim()) return;
    setCreatingTailor(true);
    try {
      const rateVal = parseFloat(newTailor.rate) || 0;
      const created = await db.entities.Tailor.create({
        name: newTailor.name.trim(),
        phone: newTailor.phone.trim(),
        specialization: newTailor.specialization,
        rate: rateVal,
        active: true,
      });
      setTailors((prev) => [created, ...prev]);
      setForm((f) => ({
        ...f,
        tailor_id: created.id,
        tailor_name: created.name,
        tailor_rate: rateVal,
      }));
      setShowTailorDialog(false);
      setNewTailor({ name: '', phone: '', specialization: 'Master Cutter', rate: '45' });
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTailor(false);
    }
  };

  const handleAddCustomMeasurementField = () => {
    const fName = newCustomField.name.trim();
    if (!fName) return;
    if (!customMeasurementFields.some((f) => f.name.toLowerCase() === fName.toLowerCase())) {
      setCustomMeasurementFields((prev) => [...prev, { name: fName, unit: newCustomField.unit || 'cm' }]);
      setForm((prev) => ({
        ...prev,
        measurement_values: { ...prev.measurement_values, [fName]: '' },
      }));
    }
    setShowCustomFieldDialog(false);
    setNewCustomField({ name: '', unit: 'cm' });
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
              <div className="flex items-center justify-between">
                <Label>Assign Tailor (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTailorDialog(true)}
                  className="h-6 px-1.5 text-xs text-primary gap-1 hover:bg-primary/10"
                >
                  <Plus className="h-3 w-3" /> Add Tailor
                </Button>
              </div>
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Measurement Template</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCustomFieldDialog(true)}
                className="h-7 px-2 text-xs text-primary border-primary/30 gap-1 hover:bg-primary/5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Custom Measurement
              </Button>
            </div>
            <Select value={form.template_id} onValueChange={(v) => {
              const t = templates.find((x) => x.id === v);
              const vals = { ...form.measurement_values };
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

            {/* Standard Template Fields */}
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

            {/* Custom On-the-fly Measurement Fields */}
            {customMeasurementFields.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-primary">Custom Added Measurements</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {customMeasurementFields.map((cf, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">{cf.name}</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMeasurementFields(prev => prev.filter((_, idx) => idx !== i));
                            const updatedVals = { ...form.measurement_values };
                            delete updatedVals[cf.name];
                            setForm({ ...form, measurement_values: updatedVals });
                          }}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          ✕
                        </button>
                      </div>
                      <Input
                        value={form.measurement_values[cf.name] || ''}
                        onChange={(e) => setForm({
                          ...form,
                          measurement_values: { ...form.measurement_values, [cf.name]: e.target.value }
                        })}
                        placeholder={cf.unit || 'cm'}
                        className="h-9 bg-card"
                      />
                    </div>
                  ))}
                </div>
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
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <Label>Style Notes & Custom Specifications</Label>
                <span className="text-[11px] text-muted-foreground">Tap tag to append on time</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  'French Cuffs',
                  'Mandarin Collar',
                  'Double Vent',
                  'Concealed Placket',
                  'Contrast Buttonholes',
                  'Hand Monogram on Cuff',
                  'Side Slits',
                  'Extra Inner Pocket',
                  'Silk Lining',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const cur = form.style_notes ? `${form.style_notes}, ${tag}` : tag;
                      setForm({ ...form, style_notes: cur });
                    }}
                    className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <Textarea
                value={form.style_notes}
                onChange={(e) => setForm({ ...form, style_notes: e.target.value })}
                placeholder="Collar type, cuff, special instructions..."
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Pricing & Custom Charges</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tailor Rate</Label>
                <Input type="number" value={form.tailor_rate} onChange={(e) => setForm({ ...form, tailor_rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Markup %</Label>
                <Input type="number" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* On-Time Custom Extra Charge */}
              <div className="space-y-1.5">
                <Label>Custom Extra Charges (AED)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.extra_charges || ''}
                  onChange={(e) => setForm({ ...form, extra_charges: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Extra Charge Reason / Note</Label>
                <Input
                  placeholder="e.g. 24h Rush Stitching, Zari Work"
                  value={form.extra_charges_note || ''}
                  onChange={(e) => setForm({ ...form, extra_charges_note: e.target.value })}
                />
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
              {form.extra_charges > 0 && (
                <div className="flex justify-between py-1 text-primary">
                  <span>Extra Charges ({form.extra_charges_note || 'Custom'})</span>
                  <span>+{formatCurrency(form.extra_charges)}</span>
                </div>
              )}
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
              {form.extra_charges > 0 && (
                <ReviewRow label={`Extra Charges (${form.extra_charges_note || 'Custom'})`} value={`+${formatCurrency(form.extra_charges)}`} />
              )}
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

      {/* Quick Add Tailor Modal */}
      <Dialog open={showTailorDialog} onOpenChange={setShowTailorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tailor On Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Tailor Name *</Label>
              <Input
                placeholder="e.g. Master Farooq"
                value={newTailor.name}
                onChange={(e) => setNewTailor({ ...newTailor, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="+971 50..."
                  value={newTailor.phone}
                  onChange={(e) => setNewTailor({ ...newTailor, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate (AED)</Label>
                <Input
                  type="number"
                  placeholder="45"
                  value={newTailor.rate}
                  onChange={(e) => setNewTailor({ ...newTailor, rate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Specialization</Label>
              <select
                value={newTailor.specialization}
                onChange={(e) => setNewTailor({ ...newTailor, specialization: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus:border-primary"
              >
                <option value="Master Cutter">Master Cutter</option>
                <option value="Suits & Blazers">Suits & Blazers</option>
                <option value="Traditional & Kandora">Traditional & Kandora</option>
                <option value="Shirts & Trousers">Shirts & Trousers</option>
                <option value="Alterations & Fitting">Alterations & Fitting</option>
                <option value="Embroidery">Embroidery</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowTailorDialog(false)}>Cancel</Button>
            <Button
              onClick={handleQuickCreateTailor}
              disabled={creatingTailor || !newTailor.name.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {creatingTailor ? 'Adding...' : 'Add & Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Custom Measurement Field Modal */}
      <Dialog open={showCustomFieldDialog} onOpenChange={setShowCustomFieldDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Custom Measurement Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Quick Suggestions</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {['Armhole', 'Bicep', 'Calf', 'Thigh', 'Cross Back', 'Crotch', 'Ankle Opening'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setNewCustomField({ ...newCustomField, name: sug })}
                    className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Measurement Name *</Label>
              <Input
                placeholder="e.g. Bicep, Cross Back"
                value={newCustomField.name}
                onChange={(e) => setNewCustomField({ ...newCustomField, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit</Label>
              <select
                value={newCustomField.unit}
                onChange={(e) => setNewCustomField({ ...newCustomField, unit: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs outline-none focus:border-primary"
              >
                <option value="cm">Centimeters (cm)</option>
                <option value="inch">Inches (in)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCustomFieldDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddCustomMeasurementField}
              disabled={!newCustomField.name.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              Add Field
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