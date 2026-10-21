import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Users, Scissors, CreditCard, Receipt,
  ShoppingBag, ClipboardList, Wallet, Sparkles, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ExpenseDialog from '@/components/accounts/ExpenseDialog';

export default function GlobalQuickAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Dialog open states
  const [customerOpen, setCustomerOpen] = useState(false);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

  // Customer form state
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: 'Dubai',
    notes: '',
  });
  const [savingCust, setSavingCust] = useState(false);

  // Tailor form state
  const [tailorForm, setTailorForm] = useState({
    name: '',
    phone: '',
    specialization: 'Master Cutter',
    rate: '45',
  });
  const [savingTailor, setSavingTailor] = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    customer_name: '',
    amount: '',
    payment_method: 'Cash',
    type: 'deposit',
    reference_number: '',
    notes: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // Custom Income form state
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

  // Notify other components across the app to reload
  const broadcastUpdate = (entity, item) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('thredo-data-updated', {
          detail: { entity, item },
        })
      );
    }
  };

  // Quick Customer Submit
  const handleSaveCustomer = async (andStartOrder = false) => {
    if (!custForm.name || !custForm.phone) {
      toast({
        title: 'Name and Phone required',
        description: 'Please provide customer name and phone number',
        variant: 'destructive',
      });
      return;
    }
    setSavingCust(true);
    try {
      const created = await db.entities.Customer.create({
        name: custForm.name.trim(),
        phone: custForm.phone.trim(),
        whatsapp: custForm.whatsapp.trim() || custForm.phone.trim(),
        email: custForm.email.trim(),
        address: custForm.address.trim(),
        city: custForm.city.trim(),
        notes: custForm.notes.trim() || 'Quick added via top bar',
        total_orders: 0,
        total_spent: 0,
        outstanding_balance: 0,
      });

      toast({
        title: 'Customer Added On Time',
        description: `${created.name} (${created.phone}) has been saved.`,
      });
      broadcastUpdate('Customer', created);
      setCustomerOpen(false);
      setCustForm({
        name: '',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        city: 'Dubai',
        notes: '',
      });

      if (andStartOrder) {
        navigate(`/orders/new?customer=${created.id}`);
      }
    } catch (e) {
      toast({
        title: 'Failed to create customer',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSavingCust(false);
    }
  };

  // Quick Tailor Submit
  const handleSaveTailor = async () => {
    if (!tailorForm.name) {
      toast({ title: 'Tailor name required', variant: 'destructive' });
      return;
    }
    setSavingTailor(true);
    try {
      const created = await db.entities.Tailor.create({
        name: tailorForm.name.trim(),
        phone: tailorForm.phone.trim(),
        specialization: tailorForm.specialization,
        rate: parseFloat(tailorForm.rate) || 0,
        active: true,
        total_orders_assigned: 0,
        completed_orders: 0,
        monthly_earnings: 0,
      });

      toast({
        title: 'Tailor Added On Time',
        description: `${created.name} (${created.specialization}) added to workshop.`,
      });
      broadcastUpdate('Tailor', created);
      setTailorOpen(false);
      setTailorForm({
        name: '',
        phone: '',
        specialization: 'Master Cutter',
        rate: '45',
      });
    } catch (e) {
      toast({
        title: 'Failed to create tailor',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSavingTailor(false);
    }
  };

  // Quick Payment Submit
  const handleSavePayment = async () => {
    if (!paymentForm.customer_name || !paymentForm.amount) {
      toast({
        title: 'Customer and amount required',
        variant: 'destructive',
      });
      return;
    }
    setSavingPayment(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const created = await db.entities.Payment.create({
        customer_name: paymentForm.customer_name.trim(),
        amount: parseFloat(paymentForm.amount) || 0,
        payment_method: paymentForm.payment_method,
        date: today,
        type: paymentForm.type,
        reference_number:
          paymentForm.reference_number.trim() ||
          `RCPT-${Math.floor(Math.random() * 90000) + 10000}`,
        notes: paymentForm.notes.trim() || 'Direct custom receipt',
      });

      toast({
        title: 'Payment Recorded On Time',
        description: `AED ${paymentForm.amount} recorded from ${paymentForm.customer_name}.`,
      });
      broadcastUpdate('Payment', created);
      setPaymentOpen(false);
      setPaymentForm({
        customer_name: '',
        amount: '',
        payment_method: 'Cash',
        type: 'deposit',
        reference_number: '',
        notes: '',
      });
    } catch (e) {
      toast({
        title: 'Failed to record payment',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSavingPayment(false);
    }
  };

  // Quick Custom Income Submit
  const handleSaveIncome = async () => {
    if (!incomeForm.amount || (!incomeForm.source && !incomeForm.custom_source)) {
      toast({
        title: 'Source and amount required',
        variant: 'destructive',
      });
      return;
    }
    setSavingIncome(true);
    try {
      const finalSource =
        incomeForm.source === 'Other' && incomeForm.custom_source
          ? incomeForm.custom_source
          : incomeForm.source;

      const created = await db.entities.Payment.create({
        customer_name: `[Inflow] ${finalSource}`,
        amount: parseFloat(incomeForm.amount) || 0,
        payment_method: incomeForm.payment_method,
        date: incomeForm.date,
        type: 'custom_income',
        reference_number:
          incomeForm.reference.trim() ||
          `INC-${Math.floor(Math.random() * 90000) + 10000}`,
        notes: incomeForm.description.trim() || `Custom Inflow: ${finalSource}`,
      });

      toast({
        title: 'Custom Inflow Recorded On Time',
        description: `AED ${incomeForm.amount} from ${finalSource} logged.`,
      });
      broadcastUpdate('Payment', created);
      setIncomeOpen(false);
      setIncomeForm({
        source: 'Fabric Scrap / Waste Sale',
        custom_source: '',
        description: '',
        amount: '',
        payment_method: 'Cash',
        reference: '',
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      toast({
        title: 'Failed to record income',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSavingIncome(false);
    }
  };

  return (
    <>
      {/* Global Quick Add Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white shadow-sm hover:from-violet-700 hover:to-purple-700 font-medium text-xs h-9 px-3 rounded-lg"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick Add</span>
            <span className="sm:hidden">Add</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl">
          <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Sales & Billing
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => navigate('/sales')}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold text-foreground">New Sale / POS</p>
                <p className="text-[10px] text-muted-foreground">Bill items & WhatsApp invoice</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Tailoring & Production
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => navigate('/orders/new')}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <ClipboardList className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold text-foreground">New Order</p>
                <p className="text-[10px] text-muted-foreground">Custom bespoke tailoring wizard</p>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setTailorOpen(true)}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <Scissors className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-foreground">Add Tailor / Master</p>
                <p className="text-[10px] text-muted-foreground">Register workshop craftsman</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Customers & Clients
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setCustomerOpen(true)}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <div>
                <p className="font-semibold text-foreground">Add Customer</p>
                <p className="text-[10px] text-muted-foreground">Instant on-time client registration</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Finance & Accounts
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setPaymentOpen(true)}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold text-foreground">Record Payment</p>
                <p className="text-[10px] text-muted-foreground">Log receipt, deposit or advance</p>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setExpenseOpen(true)}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="font-semibold text-foreground">Record Expense</p>
                <p className="text-[10px] text-muted-foreground">Log materials, rent or bills</p>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setIncomeOpen(true)}
              className="gap-2.5 cursor-pointer py-2 text-xs"
            >
              <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-semibold text-foreground">Record Custom Inflow</p>
                <p className="text-[10px] text-muted-foreground">Scrap sales, services & misc cash</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 1. Modal: Quick Add Customer */}
      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-600" /> Add Customer On Time
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input
                placeholder="e.g. Mohammed Al Mansoori"
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Phone (WhatsApp) *</Label>
                <Input
                  placeholder="+971 50..."
                  value={custForm.phone}
                  onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City / Area</Label>
                <Input
                  placeholder="Dubai / Abu Dhabi"
                  value={custForm.city}
                  onChange={(e) => setCustForm({ ...custForm, city: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Address (optional)</Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={custForm.email}
                onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address / Delivery Location</Label>
              <Input
                placeholder="Building, street, villa..."
                value={custForm.address}
                onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preferences & Notes</Label>
              <Input
                placeholder="e.g. Preferred tailor, fitting style, VIP..."
                value={custForm.notes}
                onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setCustomerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveCustomer(true)}
              disabled={savingCust || !custForm.name || !custForm.phone}
              className="text-primary border-primary/40 hover:bg-primary/5"
            >
              Save & Start Order →
            </Button>
            <Button
              size="sm"
              onClick={() => handleSaveCustomer(false)}
              disabled={savingCust || !custForm.name || !custForm.phone}
              className="bg-primary hover:bg-primary/90"
            >
              {savingCust ? 'Saving...' : 'Save Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Modal: Quick Add Tailor */}
      <Dialog open={tailorOpen} onOpenChange={setTailorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-amber-600" /> Add Tailor / Craftsman On Time
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Tailor Full Name *</Label>
              <Input
                placeholder="e.g. Master Rashid"
                value={tailorForm.name}
                onChange={(e) => setTailorForm({ ...tailorForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Phone Number</Label>
                <Input
                  placeholder="+971 55..."
                  value={tailorForm.phone}
                  onChange={(e) => setTailorForm({ ...tailorForm, phone: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Base Rate per Order (AED)</Label>
                <Input
                  type="number"
                  placeholder="45"
                  value={tailorForm.rate}
                  onChange={(e) => setTailorForm({ ...tailorForm, rate: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Specialization</Label>
              <select
                value={tailorForm.specialization}
                onChange={(e) => setTailorForm({ ...tailorForm, specialization: e.target.value })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTailorOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTailor}
              disabled={savingTailor || !tailorForm.name}
              className="bg-primary hover:bg-primary/90"
            >
              {savingTailor ? 'Saving...' : 'Add Tailor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Modal: Quick Record Payment */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" /> Record Custom Payment On Time
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Customer Name *</Label>
              <Input
                placeholder="Client name or walk-in"
                value={paymentForm.customer_name}
                onChange={(e) => setPaymentForm({ ...paymentForm, customer_name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount Received (AED) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="h-8 text-xs font-mono font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-primary"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card / POS</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI / Net Banking</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Payment Purpose</Label>
                <select
                  value={paymentForm.type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-primary"
                >
                  <option value="advance">Order Advance</option>
                  <option value="deposit">Client Deposit</option>
                  <option value="settlement">Outstanding Settlement</option>
                  <option value="service_payment">Service / Alteration Charge</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference # (optional)</Label>
                <Input
                  placeholder="Receipt / txn ref"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes / Particulars</Label>
              <Input
                placeholder="e.g. Advance for 3 suits trial"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSavePayment}
              disabled={savingPayment || !paymentForm.customer_name || !paymentForm.amount}
              className="bg-primary hover:bg-primary/90"
            >
              {savingPayment ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Modal: Expense Dialog */}
      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        onSaved={(exp) => {
          broadcastUpdate('Expense', exp);
          toast({ title: 'Expense Logged On Time' });
        }}
      />

      {/* 5. Modal: Quick Custom Inflow / Income */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
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
            <Button variant="outline" size="sm" onClick={() => setIncomeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveIncome}
              disabled={savingIncome || !incomeForm.amount}
              className="bg-primary hover:bg-primary/90"
            >
              {savingIncome ? 'Saving...' : 'Record Inflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
