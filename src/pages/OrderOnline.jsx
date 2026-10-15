import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';

import { Scissors, ShoppingBag, Plus, Minus, Check, Phone, MessageCircle, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Image } from '@/components/ui/image';

export default function OrderOnline() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('tailoring'); // 'tailoring' | 'retail'
  const [cart, setCart] = useState({}); // { productId: qty }
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', whatsapp: '', address: '', city: '', delivery_method: 'Pickup' });
  const [tailoring, setTailoring] = useState({ garment_type: '', measurements: '', fabric_preference: '', delivery_date: '', notes: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await db.functions.invoke('getOnlineOrderingConfig', {});
        setData(res.data);
        if (res.data?.config?.garment_types?.length && !tailoring.garment_type) {
          setTailoring((t) => ({ ...t, garment_type: res.data.config.garment_types[0] }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
     
  }, []);

  const config = data?.config;
  const company = data?.company;
  const products = data?.products || [];
  const currency = company?.currency || 'AED';

  const cartItems = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => {
      const p = products.find((x) => x.id === id);
      if (!p) return null;
      return { product_id: p.id, name: p.name, price: p.price, quantity: q, line_total: p.price * q };
    })
    .filter(Boolean);
  const subtotal = cartItems.reduce((s, i) => s + i.line_total, 0);

  const setQty = (id, delta) => {
    setCart((c) => {
      const q = (c[id] || 0) + delta;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  };

  const submit = async () => {
    if (!customer.name || !customer.phone) return;
    setSubmitting(true);
    try {
      let payload;
      if (mode === 'tailoring') {
        payload = {
          type: 'tailoring',
          customer,
          tailoring: {
            garment_type: tailoring.garment_type,
            measurements: tailoring.measurements ? { notes: tailoring.measurements } : {},
            fabric_preference: tailoring.fabric_preference,
            delivery_date: tailoring.delivery_date,
            notes: tailoring.notes,
          },
        };
      } else {
        if (cartItems.length === 0) return;
        payload = { type: 'retail', customer, retail: { items: cartItems } };
      }
      const res = await db.functions.invoke('submitOnlineOrder', payload);
      setResult(res.data);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
      </div>
    );
  }

  if (!config || config.enabled === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200">
            <ShoppingBag className="h-7 w-7 text-slate-500" />
          </div>
          <h1 className="text-lg font-semibold">Online ordering is unavailable</h1>
          <p className="mt-1 text-sm text-slate-500">The store is not accepting online orders right now. Please check back soon.</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-lg font-semibold">Order received!</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your reference is <span className="font-mono font-semibold text-slate-700">{result.reference}</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {result.review
              ? 'Your order is pending review. We will confirm shortly.'
              : 'Your order has been accepted. We will be in touch soon.'}
          </p>
          <Button className="mt-6 gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => { setResult(null); setCart({}); }}>
            Place another order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 text-white">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{company?.name || config.title}</p>
            <p className="text-xs text-slate-500">{config.tagline}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setMode('tailoring')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === 'tailoring' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Scissors className="h-4 w-4" /> Tailoring Order
          </button>
          <button
            onClick={() => setMode('retail')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === 'retail' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <ShoppingBag className="h-4 w-4" /> Shop Products
          </button>
        </div>

        {mode === 'tailoring' ? (
          <TailoringForm
            config={config}
            tailoring={tailoring}
            setTailoring={setTailoring}
          />
        ) : (
          <RetailShop products={products} cart={cart} setQty={setQty} currency={currency} subtotal={subtotal} />
        )}

        {/* Customer details */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Your details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Full Name *</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Phone *</Label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input value={customer.whatsapp} onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Address</Label><Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">City</Label><Input value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery</Label>
              <select
                value={customer.delivery_method}
                onChange={(e) => setCustomer({ ...customer, delivery_method: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-300 bg-transparent px-3 text-sm outline-none focus:border-violet-600"
              >
                <option value="Pickup">Pickup</option>
                <option value="Delivery">Delivery</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={submit}
          disabled={submitting || !customer.name || !customer.phone || (mode === 'retail' && cartItems.length === 0)}
          className="w-full gap-2 bg-violet-600 py-3 text-base hover:bg-violet-700"
        >
          {submitting ? 'Submitting...' : mode === 'tailoring' ? 'Submit Tailoring Order' : `Place Order · ${currency} ${subtotal.toFixed(2)}`}
        </Button>

        {/* Contact */}
        {(config.contact_phone || config.contact_whatsapp || company?.whatsapp) && (
          <div className="flex items-center justify-center gap-4 pb-6 text-sm text-slate-500">
            {config.contact_phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {config.contact_phone}</span>}
            {(config.contact_whatsapp || company?.whatsapp) && (
              <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> {config.contact_whatsapp || company.whatsapp}</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function TailoringForm({ config, tailoring, setTailoring }) {
  const garments = config.garment_types || [];
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Tailoring request</h2>
      {garments.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Garment type</Label>
          <div className="flex flex-wrap gap-2">
            {garments.map((g) => (
              <button
                key={g}
                onClick={() => setTailoring({ ...tailoring, garment_type: g })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${tailoring.garment_type === g ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Fabric preference</Label><Input value={tailoring.fabric_preference} onChange={(e) => setTailoring({ ...tailoring, fabric_preference: e.target.value })} placeholder="e.g. Cotton, Linen" /></div>
        <div className="space-y-1"><Label className="text-xs">Preferred delivery date</Label><Input type="date" value={tailoring.delivery_date} onChange={(e) => setTailoring({ ...tailoring, delivery_date: e.target.value })} /></div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Measurements / notes</Label>
        <Textarea value={tailoring.measurements} onChange={(e) => setTailoring({ ...tailoring, measurements: e.target.value })} placeholder="Share your measurements or any styling notes. We can also take them in-store." rows={3} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Additional notes</Label>
        <Textarea value={tailoring.notes} onChange={(e) => setTailoring({ ...tailoring, notes: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

function RetailShop({ products, cart, setQty, currency, subtotal }) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No products are available for online ordering right now.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {p.image_url ? <Image src={p.image_url} fittingType="fill" className="h-full w-full" /> : <ShoppingBag className="h-6 w-6 text-slate-300" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{p.name}</p>
            <p className="text-xs text-slate-500">{p.category} · {currency} {p.price}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(p.id, -1)} disabled={!cart[p.id]}><Minus className="h-3.5 w-3.5" /></Button>
            <span className="w-6 text-center text-sm font-medium">{cart[p.id] || 0}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(p.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold">
        <span>Total</span><span>{currency} {subtotal.toFixed(2)}</span>
      </div>
    </div>
  );
}