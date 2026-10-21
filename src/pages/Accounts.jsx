import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';

import { formatCurrency, formatDate } from '@/lib/mehar-utils';
import KpiCard from '@/components/KpiCard';
import ExpenseDialog from '@/components/accounts/ExpenseDialog';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

export default function Accounts() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    source: 'Fabric Scrap / Waste Sale',
    custom_source: '',
    description: '',
    amount: '',
    payment_method: 'Cash',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [savingIncome, setSavingIncome] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [payments, expenses, orders, sales] = await Promise.all([
        db.entities.Payment.list('-created_date', 500),
        db.entities.Expense.filter({}, { sort: '-date', limit: 200 }),
        db.entities.Order.list('-created_date', 500),
        db.entities.Sale.list('-created_date', 500),
      ]);
      const expList = Array.isArray(expenses) ? expenses : (expenses?.items || []);
      setData({ payments: payments || [], expenses: expList, orders: orders || [], sales: sales || [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleSync = (e) => {
      const ent = e.detail?.entity;
      if (ent === 'Payment' || ent === 'Expense' || ent === 'Order' || ent === 'Sale') {
        load();
      }
    };
    window.addEventListener('thredo-data-updated', handleSync);
    return () => window.removeEventListener('thredo-data-updated', handleSync);
  }, []);

  const m = React.useMemo(() => {
    if (!data) return null;
    const { payments, expenses, orders, sales } = data;
    const pos = (n) => Math.max(0, n || 0);

    const income = payments.filter((p) => p.type !== 'refund').reduce((s, p) => s + (p.amount || 0), 0);
    const refunds = payments.filter((p) => p.type === 'refund').reduce((s, p) => s + (p.amount || 0), 0);
    const recordedExpenses = expenses.reduce((s, x) => s + (x.amount || 0), 0);
    const productionCosts = orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((s, o) => s + (o.tailor_rate || 0) + (o.fabric_cost || 0), 0);
    const totalExpenses = recordedExpenses + productionCosts;
    const netProfit = income - refunds - totalExpenses;
    const receivables =
      orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + pos(o.balance_due), 0) +
      sales.filter((s2) => s2.status !== 'Cancelled' && s2.status !== 'Refunded').reduce((s, s2) => s + pos(s2.balance_due), 0);

    const incomeLedger = payments
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 15);

    return { income, refunds, recordedExpenses, productionCosts, totalExpenses, netProfit, receivables, incomeLedger, expenses };
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">Income, expenses and profitability at a glance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 text-indigo-600 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            onClick={() => setIncomeDialogOpen(true)}
          >
            <Wallet className="h-4 w-4" /> Record Custom Inflow
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Record Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard index={0} label="Income (Collected)" value={m ? formatCurrency(m.income) : '—'} icon={Wallet} accent="accent" trend="Payments received" />
        <KpiCard index={1} label="Total Expenses" value={m ? formatCurrency(m.totalExpenses) : '—'} icon={TrendingDown} accent="danger" trend="Recorded + production" />
        <KpiCard index={2} label="Net Profit" value={m ? formatCurrency(m.netProfit) : '—'} icon={PiggyBank} accent={m && m.netProfit < 0 ? 'danger' : 'primary'} trend="After refunds & costs" />
        <KpiCard index={3} label="Receivables" value={m ? formatCurrency(m.receivables) : '—'} icon={TrendingUp} accent="warning" trend="Unpaid balances" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Expense breakdown */}
        <div className="card-shadow rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Expense Breakdown</h3>
          {loading || !m ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <Row label="Recorded expenses" value={formatCurrency(m.recordedExpenses)} />
              <Row label="Tailor charges (production)" value={formatCurrency(m.productionCosts)} />
              <Row label="Refunds issued" value={formatCurrency(m.refunds)} />
              <div className="border-t border-border pt-3">
                <Row label="Total outflow" value={formatCurrency(m.totalExpenses + m.refunds)} bold />
              </div>
              {m.expenses.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Recent recorded expenses</p>
                  {m.expenses.slice(0, 5).map((x) => (
                    <div key={x.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">{x.category}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(x.date)}{x.description ? ` · ${x.description}` : ''}</p>
                      </div>
                      <span className="text-xs font-semibold">{formatCurrency(x.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Income ledger */}
        <div className="card-shadow rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Income Ledger</h3>
          {loading || !m ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : m.incomeLedger.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <Receipt className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Order</th>
                    <th className="pb-2 pr-4 font-medium">Customer</th>
                    <th className="pb-2 pr-4 font-medium">Method</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {m.incomeLedger.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(p.date)}</td>
                      <td className="py-2.5 pr-4 font-medium">{p.order_ref || p.order_id || '—'}</td>
                      <td className="py-2.5 pr-4">{p.customer_name || '—'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{p.payment_method}</td>
                      <td className={`py-2.5 text-right font-semibold ${p.type === 'refund' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {p.type === 'refund' ? '−' : '+'}{formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          load();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('thredo-data-updated', { detail: { entity: 'Expense' } }));
          }
        }}
      />

      {/* Record Custom Inflow / Income Modal */}
      <Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-indigo-600" /> Record Custom Inflow / Income
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Revenue / Inflow Source *</Label>
              <select
                value={incomeForm.source}
                onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-primary"
              >
                <option value="Fabric Scrap / Waste Sale">Fabric Scrap & Remnants Sale</option>
                <option value="Sewing Machine / Tool Rental">Machine / Tool Rental</option>
                <option value="Styling & Wardrobe Consultation">Styling & Consultation Fee</option>
                <option value="Express Alteration Walk-in">Express Alteration Walk-in Cash</option>
                <option value="Pattern Drafting Service">Pattern Drafting Service</option>
                <option value="Delivery / Courier Charge">Courier / Delivery Reimbursement</option>
                <option value="Other">Other Custom Inflow...</option>
              </select>
            </div>
            {incomeForm.source === 'Other' && (
              <div className="space-y-1">
                <Label className="text-xs">Custom Source Title *</Label>
                <Input
                  placeholder="e.g. Sponsoring exhibition, workshop rent..."
                  value={incomeForm.custom_source}
                  onChange={(e) => setIncomeForm({ ...incomeForm, custom_source: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount Received (AED) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  className="h-8 text-xs font-mono font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <select
                  value={incomeForm.payment_method}
                  onChange={(e) => setIncomeForm({ ...incomeForm, payment_method: e.target.value })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-primary"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description / Particulars</Label>
              <Input
                placeholder="Details of the transaction..."
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={incomeForm.date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference #</Label>
                <Input
                  placeholder="Voucher / txn ID"
                  value={incomeForm.reference}
                  onChange={(e) => setIncomeForm({ ...incomeForm, reference: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIncomeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!incomeForm.amount || (!incomeForm.source && !incomeForm.custom_source)) return;
                setSavingIncome(true);
                try {
                  const finalSource = incomeForm.source === 'Other' && incomeForm.custom_source
                    ? incomeForm.custom_source
                    : incomeForm.source;

                  await db.entities.Payment.create({
                    customer_name: `[Inflow] ${finalSource}`,
                    amount: parseFloat(incomeForm.amount) || 0,
                    payment_method: incomeForm.payment_method,
                    date: incomeForm.date,
                    type: 'custom_income',
                    reference_number: incomeForm.reference.trim() || `INC-${Math.floor(Math.random() * 90000) + 10000}`,
                    notes: incomeForm.description.trim() || `Custom Inflow: ${finalSource}`,
                  });

                  toast({ title: 'Custom Inflow Recorded On Time' });
                  setIncomeDialogOpen(false);
                  setIncomeForm({
                    source: 'Fabric Scrap / Waste Sale',
                    custom_source: '',
                    description: '',
                    amount: '',
                    payment_method: 'Cash',
                    reference: '',
                    date: new Date().toISOString().slice(0, 10),
                  });
                  load();
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('thredo-data-updated', { detail: { entity: 'Payment' } }));
                  }
                } catch (err) {
                  toast({ title: 'Failed to record inflow', description: err.message, variant: 'destructive' });
                } finally {
                  setSavingIncome(false);
                }
              }}
              disabled={savingIncome || !incomeForm.amount}
              className="bg-primary hover:bg-primary/90"
            >
              {savingIncome ? 'Saving...' : 'Record Inflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={bold ? 'font-bold' : 'font-medium'}>{value}</span>
    </div>
  );
}