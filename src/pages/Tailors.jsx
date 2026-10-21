import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { formatCurrency } from '@/lib/mehar-utils';
import { Plus, Scissors, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function Tailors() {
  const [tailors, setTailors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadTailors();
    const handleSync = (e) => {
      if (e.detail?.entity === 'Tailor') loadTailors();
    };
    window.addEventListener('thredo-data-updated', handleSync);
    return () => window.removeEventListener('thredo-data-updated', handleSync);
  }, []);

  const loadTailors = async () => {
    try {
      const data = await db.entities.Tailor.list('-created_date', 50);
      setTailors(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const activeCount = tailors.filter((t) => t.active).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workshop</h1>
          <p className="text-sm text-muted-foreground">{tailors.length} tailors • {activeCount} active</p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Tailor
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
      ) : tailors.length === 0 ? (
        <div className="card-shadow flex h-40 flex-col items-center justify-center rounded-xl border border-border bg-card">
          <Scissors className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tailors added yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tailors.map((t, i) => {
            const completion = t.total_orders_assigned > 0
              ? Math.round((t.completed_orders / t.total_orders_assigned) * 100)
              : 0;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-shadow rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-emerald-600 text-white">
                      <Scissors className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.specialization}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'}`}>
                    {t.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  {t.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {t.phone}</span>}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                  <div>
                    <p className="text-lg font-bold">{t.total_orders_assigned || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Assigned</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{completion}%</p>
                    <p className="text-[10px] text-muted-foreground">Completion</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{formatCurrency(t.monthly_earnings || 0, '')}</p>
                    <p className="text-[10px] text-muted-foreground">Earned</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Progress</span><span>{completion}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${completion}%` }} />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">{t.rate_type === 'hourly' ? 'Hourly' : 'Piecework'}</span>
                  <span className="font-medium">{formatCurrency(t.rate || 0)} / {t.rate_type === 'hourly' ? 'hr' : 'pc'}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AddTailorDialog open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadTailors} />
    </div>
  );
}

function AddTailorDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', specialization: 'Master Cutter', department: 'Workshop', rate_type: 'piecework', rate: 45 });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const created = await db.entities.Tailor.create({ ...form, active: true, total_orders_assigned: 0, completed_orders: 0, monthly_earnings: 0 });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('thredo-data-updated', { detail: { entity: 'Tailor', item: created } }));
      }
      setForm({ name: '', phone: '', email: '', specialization: 'Master Cutter', department: 'Workshop', rate_type: 'piecework', rate: 45 });
      onCreated();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Tailor / Craftsman On Time</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Master Rashid" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971..." className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tailor@workshop.ae" className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Specialization</Label>
            <select
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-primary"
            >
              <option value="Master Cutter">Master Cutter & Pattern Specialist</option>
              <option value="Suits & Blazers">Suits, Blazers & Tuxedos</option>
              <option value="Kandora & Traditional">Kandora / Dishdasha Specialist</option>
              <option value="Shirts & Trousers">Shirts & Formal Trousers</option>
              <option value="Alterations & Fitting">Alterations & Precision Fitting</option>
              <option value="Embroidery & Zari">Embroidery, Zari & Handwork</option>
              <option value="Finishing & Pressing">Finishing, Buttons & Pressing</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Rate Type</Label>
              <Select value={form.rate_type} onValueChange={(v) => setForm({ ...form, rate_type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piecework">Piecework (Per Item)</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Standard Rate (AED)</Label>
              <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} className="h-8 text-xs font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.name} className="bg-primary hover:bg-primary/90" size="sm">
            {saving ? 'Saving...' : 'Add Tailor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}