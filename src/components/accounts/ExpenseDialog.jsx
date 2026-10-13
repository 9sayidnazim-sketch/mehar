import { db } from '@/api/base44Client';
import React, { useState } from 'react';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = ['Fabric Purchase', 'Thread & Accessories', 'Salaries', 'Rent', 'Utilities', 'Equipment', 'Marketing', 'Transport', 'Other'];
const METHODS = ['Cash', 'Card', 'UPI', 'Bank Transfer'];

export default function ExpenseDialog({ open, onOpenChange, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: 'Other', description: '', amount: '', payment_method: 'Cash', reference_number: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.amount || !form.date) return;
    setSaving(true);
    try {
      const created = await db.entities.Expense.create({
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        reference_number: form.reference_number,
      });
      toast({ title: 'Expense recorded' });
      setForm({ date: new Date().toISOString().slice(0, 10), category: 'Other', description: '', amount: '', payment_method: 'Cash', reference_number: '' });
      onOpenChange(false);
      onSaved(created);
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to save expense', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount *</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-primary"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-primary"
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Reference</Label>
            <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Receipt / invoice no." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={save} disabled={saving || !form.amount || !form.date}>
            <Plus className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}