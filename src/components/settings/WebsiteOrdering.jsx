import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';

import { Globe, Plus, Trash2, Save, ShoppingBag, Scissors, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

const DEFAULTS = {
  enabled: false,
  auto_accept: false,
  title: 'Place Your Order',
  tagline: 'Tailoring & retail, made easy.',
  product_ids: [],
  garment_types: ['Shirt', 'Pant', 'Suit', 'Kurta'],
  contact_phone: '',
  contact_whatsapp: '',
};

export default function WebsiteOrdering() {
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newGarment, setNewGarment] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [configs, prods] = await Promise.all([
          db.entities.WebsiteConfig.list('-created_date', 5),
          db.entities.Product.list('-created_date', 100),
        ]);
        setProducts(prods || []);
        const c = configs[0] ? { ...DEFAULTS, ...configs[0] } : { ...DEFAULTS };
        setForm(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.id) {
        await db.entities.WebsiteConfig.update(form.id, payload);
      } else {
        const saved = await db.entities.WebsiteConfig.create(payload);
        setForm({ ...saved });
      }
      toast({ title: 'Website ordering settings saved' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (id) => {
    const ids = form.product_ids || [];
    setForm({
      ...form,
      product_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    });
  };

  const addGarment = () => {
    const g = newGarment.trim();
    if (!g) return;
    setForm({ ...form, garment_types: [...(form.garment_types || []), g] });
    setNewGarment('');
  };
  const removeGarment = (i) => {
    setForm({ ...form, garment_types: form.garment_types.filter((_, idx) => idx !== i) });
  };

  if (loading || !form) {
    return <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>;
  }

  const embedUrl = `${window.location.origin}/order-online`;

  return (
    <div className="space-y-5">
      <div className="card-shadow space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Online Ordering Website</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">{form.enabled ? 'Enabled' : 'Disabled'}</Label>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          A public, embeddable page where customers place tailoring orders or buy retail products. Orders land directly in your Orders &amp; Sales modules.
        </p>

        <div className="rounded-lg bg-muted/50 p-3">
          <Label className="text-xs text-muted-foreground">Public / embed URL</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input readOnly value={embedUrl} className="font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(embedUrl); toast({ title: 'Link copied' }); }}>
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Embed this in any website with an iframe, or share the link directly.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Auto-accept incoming orders</p>
            <p className="text-xs text-muted-foreground">Off = orders are held as “pending review” for approval before entering your workflow.</p>
          </div>
          <Switch checked={form.auto_accept} onCheckedChange={(v) => setForm({ ...form, auto_accept: v })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Page Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Phone</Label>
            <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact WhatsApp</Label>
            <Input value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Garment types for tailoring */}
      <div className="card-shadow space-y-3 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Garment Types (Tailoring)</h3>
        </div>
        <p className="text-sm text-muted-foreground">Garment types customers can choose from on the public page.</p>
        <div className="flex flex-wrap gap-2">
          {(form.garment_types || []).map((g, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              {g}
              <button onClick={() => removeGarment(i)} className="ml-1 text-violet-500 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
          {(!form.garment_types || form.garment_types.length === 0) && (
            <span className="text-xs text-muted-foreground">No garment types yet.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input value={newGarment} onChange={(e) => setNewGarment(e.target.value)} placeholder="Add garment type (e.g. Blazer)" onKeyDown={(e) => e.key === 'Enter' && addGarment()} />
          <Button variant="outline" onClick={addGarment} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      {/* Featured products for retail */}
      <div className="card-shadow space-y-3 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Featured Products (Retail)</h3>
        </div>
        <p className="text-sm text-muted-foreground">Select which products appear on the public ordering page.</p>
        {products.length === 0 ? (
          <p className="text-xs text-muted-foreground">No products found. Add products in the Sales module first.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((p) => {
              const checked = (form.product_ids || []).includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category} · {p.price} {p.stock != null ? `· ${p.stock} in stock` : ''}</p>
                  </div>
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'border-primary bg-primary text-white' : 'border-muted-foreground/30'}`}>
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90">
          {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}