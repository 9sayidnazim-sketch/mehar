import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import {
  Building2, Ruler, CreditCard, Palette, Plus, Trash2,
  Save, Globe, ShoppingBag, Edit, Package,
  MessageCircle, CheckCircle2, RefreshCw, AlertTriangle, QrCode
} from 'lucide-react';
import WhatsAppLinkModal from '@/components/WhatsAppLinkModal';
import WebsiteOrdering from '@/components/settings/WebsiteOrdering';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const TABS = [
  { key: 'company', label: 'Company Profile', icon: Building2 },
  { key: 'whatsapp', label: 'WhatsApp Gateway', icon: MessageCircle },
  { key: 'products', label: 'Products & Catalog', icon: ShoppingBag },
  { key: 'templates', label: 'Measurement Templates', icon: Ruler },
  { key: 'payment', label: 'Payment Methods', icon: CreditCard },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'website', label: 'Website Ordering', icon: Globe },
];

export default function Settings() {
  const [tab, setTab] = useState('company');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your tailoring and retail business</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {tab === 'company' && <CompanyProfile />}
        {tab === 'whatsapp' && <WhatsAppGatewaySettings />}
        {tab === 'products' && <ProductsCatalog />}
        {tab === 'templates' && <MeasurementTemplates />}
        {tab === 'payment' && <PaymentMethods />}
        {tab === 'branding' && <Branding />}
        {tab === 'website' && <WebsiteOrdering />}
      </motion.div>
    </div>
  );
}

function CompanyProfile() {
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const list = await db.entities.Company.list('-created_date', 50);
      const def = list.find((c) => c.is_default) || list[0] || null;
      if (def) {
        const f = { name: '', legal_name: '', registration_number: '', address: '', phone: '', email: '', whatsapp: '', tax_number: '', currency: 'AED', timezone: 'Asia/Dubai', logo_url: '', is_default: true, ...def };
        Object.keys(f).forEach((k) => { if (f[k] == null) f[k] = ''; });
        setForm(f);
      } else {
        setForm({
          name: '', legal_name: '', registration_number: '', address: '',
          phone: '', email: '', whatsapp: '', tax_number: '',
          currency: 'AED', timezone: 'Asia/Dubai', logo_url: '', is_default: true,
        });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const save = async () => {
    if (!form.name) { toast({ title: 'Company name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { ...form, is_default: true };
      const saved = form.id
        ? await db.entities.Company.update(form.id, payload)
        : await db.entities.Company.create(payload);
      setForm({ ...saved });
      toast({ title: 'Company profile saved', description: 'This company name & details will appear on all generated bills.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading || !form) {
    return <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="card-shadow space-y-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
        <Building2 className="h-4 w-4 shrink-0" />
        This company profile is used as the sender on every generated bill, invoice, and WhatsApp / email message.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>Company Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Legal Name</Label><Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Registration Number</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Tax / VAT Number</Label><Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>WhatsApp Number</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AED">AED (Dirham)</SelectItem>
              <SelectItem value="INR">INR (Rupee)</SelectItem>
              <SelectItem value="USD">USD (Dollar)</SelectItem>
              <SelectItem value="EUR">EUR (Euro)</SelectItem>
              <SelectItem value="GBP">GBP (Pound)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
              <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !form.name} className="gap-2 bg-primary hover:bg-primary/90"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}</Button>
      </div>
    </div>
  );
}

function MeasurementTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await db.entities.MeasurementTemplate.list('-created_date', 50);
      setTemplates(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setEditing({ name: '', category: 'Unisex', fields: [], is_active: true })}>
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="card-shadow flex h-32 flex-col items-center justify-center rounded-xl border border-border bg-card">
          <Ruler className="mb-2 h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="card-shadow rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <span className="text-xs text-muted-foreground">{t.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${t.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'}`}>
                    {t.is_active ? 'Active' : 'Archived'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Edit</Button>
                </div>
              </div>
              {t.fields?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.fields.map((f, i) => (
                    <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{f.field_name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(template);
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setForm({ ...form, fields: [...(form.fields || []), { field_name: '', unit: 'cm', default_value: '', is_required: false, show_in_quick_view: true }] });
  };
  const updateField = (i, key, val) => {
    const fields = [...form.fields];
    fields[i] = { ...fields[i], [key]: val };
    setForm({ ...form, fields });
  };
  const removeField = (i) => {
    setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) });
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (form.id) {
        await db.entities.MeasurementTemplate.update(form.id, form);
      } else {
        await db.entities.MeasurementTemplate.create(form);
      }
      toast({ title: 'Template saved' });
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="card-shadow fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{form.id ? 'Edit Template' : 'New Template'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Template Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shirt, Pant, Suit..." /></div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Men">Men</SelectItem>
                <SelectItem value="Women">Women</SelectItem>
                <SelectItem value="Kids">Kids</SelectItem>
                <SelectItem value="Unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <Label>Fields</Label>
            <Button variant="outline" size="sm" onClick={addField} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Field</Button>
          </div>
          <div className="space-y-2">
            {form.fields?.length === 0 && <p className="text-sm text-muted-foreground">No fields yet. Add measurement fields like Chest, Waist, Length...</p>}
            {form.fields?.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Input value={f.field_name} onChange={(e) => updateField(i, 'field_name', e.target.value)} placeholder="Field name" className="h-8 flex-1" />
                <Input value={f.unit} onChange={(e) => updateField(i, 'unit', e.target.value)} placeholder="Unit" className="h-8 w-20" />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <Switch checked={f.is_required} onCheckedChange={(v) => updateField(i, 'is_required', v)} /> Req
                </label>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeField(i)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name} className="gap-2 bg-primary hover:bg-primary/90">
            {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Template</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentMethods() {
  const methods = [
    { name: 'Cash', type: 'Cash', active: true, icon: '💵' },
    { name: 'Credit/Debit Card', type: 'Digital', active: true, icon: '💳' },
    { name: 'UPI', type: 'Digital', active: true, icon: '📱' },
    { name: 'Bank Transfer', type: 'Bank', active: true, icon: '🏦' },
    { name: 'Apple Pay', type: 'Digital', active: false, icon: '🍎' },
    { name: 'Google Pay', type: 'Digital', active: false, icon: '🔵' },
  ];

  return (
    <div className="card-shadow rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 font-semibold">Payment Methods</h3>
      <div className="space-y-2">
        {methods.map((m) => (
          <div key={m.name} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{m.icon}</span>
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.type}</p>
              </div>
            </div>
            <Switch defaultChecked={m.active} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Branding() {
  const { toast } = useToast();
  const [primary, setPrimary] = useState('#5B3DF5');
  const [accent, setAccent] = useState('#10B981');

  return (
    <div className="card-shadow space-y-5 rounded-xl border border-border bg-card p-6">
      <h3 className="font-semibold">Brand Colors</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 rounded border border-border" />
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Accent Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 rounded border border-border" />
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="flex-1" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="mb-2 text-xs text-muted-foreground">Preview</p>
        <div className="flex gap-2">
          <span className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: primary }}>Primary Button</span>
          <span className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: accent }}>Accent Button</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => toast({ title: 'Branding saved' })} className="gap-2 bg-primary hover:bg-primary/90"><Save className="h-4 w-4" /> Save</Button>
      </div>
    </div>
  );
}

function ProductsCatalog() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'Fabrics',
    price: '',
    unit: 'meters',
    stock: 50,
    is_active: true,
  });

  const load = async () => {
    try {
      const data = await db.entities.Product.list('-created_date', 100);
      setProducts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      sku: `PROD-${Math.floor(Math.random() * 9000) + 1000}`,
      category: 'Fabrics',
      price: '',
      unit: 'meters',
      stock: 50,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      category: p.category || 'Fabrics',
      price: p.price ?? 0,
      unit: p.unit || 'piece',
      stock: p.stock ?? 0,
      is_active: p.is_active ?? true,
    });
    setIsDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!form.name || form.price === '') {
      toast({ title: 'Please provide a product name and price', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
        category: form.category,
        price: parseFloat(form.price) || 0,
        unit: form.unit,
        stock: parseInt(form.stock) || 0,
        is_active: form.is_active,
      };

      if (editingProduct?.id) {
        await db.entities.Product.update(editingProduct.id, payload);
        toast({ title: 'Product updated successfully' });
      } else {
        await db.entities.Product.create(payload);
        toast({ title: 'Product added successfully' });
      }

      setIsDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: 'Failed to save product', description: e.message, variant: 'destructive' });
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await db.entities.Product.delete(id);
      toast({ title: 'Product deleted' });
      load();
    } catch (e) {
      toast({ title: 'Failed to delete product', description: e.message, variant: 'destructive' });
    }
  };

  const toggleStatus = async (p) => {
    try {
      await db.entities.Product.update(p.id, { is_active: !p.is_active });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const categories = ['All', 'Fabrics', 'Tailoring', 'Ready-to-Wear', 'Accessories', 'Services'];

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    const matchCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="card-shadow space-y-6 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Products & Inventory Catalog</h3>
          <p className="text-sm text-muted-foreground">{products.length} products available for Point of Sale and Online Store</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Input
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-36 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-center">
          <Package className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No products found. Click "Add Product" to create one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Product / SKU</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Price (AED)</th>
                <th className="px-4 py-2.5 font-medium">Stock / Unit</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.sku || 'NO-SKU'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {p.category || 'General'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    AED {Number(p.price || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.stock ?? '—'} {p.unit || ''}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(p)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-medium">Product Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Italian Wool Fabric"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">SKU / Code</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="FAB-001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fabrics">Fabrics</SelectItem>
                    <SelectItem value="Tailoring">Tailoring</SelectItem>
                    <SelectItem value="Ready-to-Wear">Ready-to-Wear</SelectItem>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium">Price (AED) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Stock</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meters">meters</SelectItem>
                    <SelectItem value="piece">piece</SelectItem>
                    <SelectItem value="set">set</SelectItem>
                    <SelectItem value="hours">hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Active Status</p>
                <p className="text-xs text-muted-foreground">Show in POS & catalog</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveProduct} className="bg-primary hover:bg-primary/90">
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WhatsAppGatewaySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [codeUrl, setCodeUrl] = useState(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/qr');
      const data = await res.json();
      setStatus(data);
      if (data.qrcode) {
        setQrCodeData(data.qrcode);
      } else {
        setQrCodeData('/orbit-qr.png');
      }
      if (data.code) {
        setCodeUrl(data.code);
      }
    } catch (e) {
      console.error(e);
      setQrCodeData('/orbit-qr.png');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const isLoggedIn = Boolean(status?.loggedIn || status?.data?.LoggedIn || (status?.ok && status?.connected && status?.loggedIn));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/20 text-[#25D366]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Orbit WhatsApp Gateway</h2>
              <p className="text-xs text-muted-foreground">
                Automated A4 PDF tax invoices & sales dispatch via WhatsApp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
            <Button
              size="sm"
              onClick={() => setLinkModalOpen(true)}
              className="gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold"
            >
              <QrCode className="h-3.5 w-3.5" />
              {isLoggedIn ? 'Re-link WhatsApp' : 'Link Device (Scan QR)'}
            </Button>
          </div>
        </div>

        {/* Live Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <span className="text-[11px] text-muted-foreground block">Socket Connection</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-xs font-semibold text-foreground">
                {status?.connected ? 'Connected to Gateway' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <span className="text-[11px] text-muted-foreground block">Session State</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${isLoggedIn ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-xs font-semibold text-foreground">
                {isLoggedIn ? 'Logged In & Ready' : 'Not Logged In (QR Required)'}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <span className="text-[11px] text-muted-foreground block">Configured Sender</span>
            <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-medium text-foreground">
              <span>+63 956 244 1681</span>
            </div>
          </div>
        </div>

        {/* QR Section if not logged in */}
        {!isLoggedIn ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Orbit WhatsApp instance is not connected or logged in
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  To send invoices to customer phone numbers, scan the QR code below using your WhatsApp mobile app under <strong>Linked Devices</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2 bg-card rounded-lg p-4 border border-border">
              <div className="p-2 bg-white rounded-lg border border-border shadow-sm">
                <img
                  src={qrCodeData || '/orbit-qr.png'}
                  alt="WhatsApp Pairing QR"
                  className="h-44 w-44 object-contain"
                />
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground text-sm">Quick Linking Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs">
                  <li>Open <strong>WhatsApp</strong> on your phone</li>
                  <li>Tap <strong>Settings</strong> or <strong>Menu (⋮)</strong></li>
                  <li>Select <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
                  <li>Point your phone camera at this QR code</li>
                </ol>
                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchStatus}
                    className="text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3 w-3" /> Check If Logged In
                  </Button>
                  {codeUrl && (
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      <a href={codeUrl} target="_blank" rel="noopener noreferrer">
                        Direct Pairing Link
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  WhatsApp Instance is Connected & Active
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Invoices and receipts will be dispatched with PDF documents attached.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLinkModalOpen(true)}
              className="text-xs gap-1.5"
            >
              <QrCode className="h-3.5 w-3.5" /> Re-scan / Change Device
            </Button>
          </div>
        )}
      </div>

      <WhatsAppLinkModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        onConnected={() => {
          fetchStatus();
          toast({
            title: 'WhatsApp Connected!',
            description: 'Your WhatsApp device is now connected and ready to send invoices.',
          });
        }}
      />
    </div>
  );
}