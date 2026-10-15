import React, { useEffect, useState } from 'react';
import { db } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ShieldCheck, AlertCircle, Check, X, Plus, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatDubaiTime } from '../../base44/shared/access.js';

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('payments'); // 'payments' | 'businesses' | 'coupons' | 'plans' | 'audit'

  // Data states
  const [submissions, setSubmissions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [rejectDialog, setRejectDialog] = useState({ open: false, submissionId: null, reason: '' });
  const [approveDialog, setApproveDialog] = useState({ open: false, submission: null });
  const [grantDialog, setGrantDialog] = useState({ open: false, businessId: '', days: 30, reason: '' });
  const [revokeDialog, setRevokeDialog] = useState({ open: false, businessId: '', reason: '' });
  const [couponDialog, setCouponDialog] = useState({ open: false, code: '', duration_hours: 48, max_redemptions: 1, valid_until: '' });
  const [planDialog, setPlanDialog] = useState({ open: false, plan: null });

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, cList, pList, aList] = await Promise.all([
        db.entities.PaymentSubmission.list('created_date', 100), // Oldest first
        db.entities.Coupon.list('-created_date', 100),
        db.entities.SubscriptionPlan.list('sort_order', 50),
        db.entities.AuditLog.list('-created_date', 100)
      ]);
      setSubmissions(subs || []);
      setCoupons(cList || []);
      setPlans(pList || []);
      setAuditLogs(aList || []);
    } catch (e) {
      toast({ title: 'Error loading admin data', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingSubmissions = submissions.filter((s) => s.status === 'pending_verification');
  const now = Date.now();
  const olderThan24hCount = pendingSubmissions.filter(
    (s) => s.created_date && now - new Date(s.created_date).getTime() > 24 * 60 * 60 * 1000
  ).length;

  // Actions
  const handleApprove = async () => {
    const sub = approveDialog.submission;
    if (!sub) return;
    try {
      const res = await db.functions.invoke('adminApprovePayment', { submission_id: sub.id });
      if (res.ok) {
        toast({ title: 'Payment Approved', description: `Subscription active until ${res.expires_at?.slice(0, 10)}.` });
        setApproveDialog({ open: false, submission: null });
        loadData();
      } else {
        toast({ title: 'Approval Failed', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    const { submissionId, reason } = rejectDialog;
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'Please enter a rejection reason.', variant: 'destructive' });
      return;
    }
    try {
      const res = await db.functions.invoke('adminRejectPayment', { submission_id: submissionId, reason: reason.trim() });
      if (res.ok) {
        toast({ title: 'Payment Rejected', description: 'User notified and access restricted.' });
        setRejectDialog({ open: false, submissionId: null, reason: '' });
        loadData();
      } else {
        toast({ title: 'Rejection Failed', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleGrantDays = async () => {
    const { businessId, days, reason } = grantDialog;
    try {
      const res = await db.functions.invoke('adminManageAccess', {
        action: 'grant_days',
        business_id: businessId,
        days: Number(days),
        reason
      });
      if (res.ok) {
        toast({ title: 'Access Extended', description: `Granted ${days} days.` });
        setGrantDialog({ open: false, businessId: '', days: 30, reason: '' });
        loadData();
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRevoke = async () => {
    const { businessId, reason } = revokeDialog;
    try {
      const res = await db.functions.invoke('adminManageAccess', {
        action: 'revoke',
        business_id: businessId,
        reason
      });
      if (res.ok) {
        toast({ title: 'Access Revoked', description: 'Business access was terminated.' });
        setRevokeDialog({ open: false, businessId: '', reason: '' });
        loadData();
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    const { code, duration_hours, max_redemptions, valid_until } = couponDialog;
    try {
      const res = await db.functions.invoke('adminManageAccess', {
        action: 'create_coupon',
        code,
        duration_hours,
        max_redemptions,
        valid_until: valid_until || null
      });
      if (res.ok) {
        toast({ title: 'Coupon Created', description: `Code: ${res.coupon?.code}` });
        setCouponDialog({ open: false, code: '', duration_hours: 48, max_redemptions: 1, valid_until: '' });
        loadData();
      } else {
        toast({ title: 'Failed', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      await db.functions.invoke('adminManageAccess', {
        action: 'toggle_coupon',
        coupon_id: coupon.id,
        is_active: !coupon.is_active
      });
      loadData();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const p = planDialog.plan;
    try {
      const res = await db.functions.invoke('adminManageAccess', {
        action: 'save_plan',
        ...p
      });
      if (res.ok) {
        toast({ title: 'Plan Saved', description: p.name });
        setPlanDialog({ open: false, plan: null });
        loadData();
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Platform Administration
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">Admin Operations Console</h1>
          <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">
            Manage subscriber verification, payments queue, coupon passes, and security audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {[
          { id: 'payments', label: `Payments Queue (${pendingSubmissions.length})`, count: olderThan24hCount },
          { id: 'coupons', label: `Coupons (${coupons.length})` },
          { id: 'plans', label: `Subscription Plans (${plans.length})` },
          { id: 'audit', label: `Audit Log (${auditLogs.length})` }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              tab === t.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[9px] font-bold">
                {t.count} &gt;24h
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Payments Queue */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {olderThan24hCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{olderThan24hCount} submission(s)</strong> have been awaiting verification for more than 24 hours.
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3.5">Submitted</th>
                    <th className="p-3.5">Business & Contact</th>
                    <th className="p-3.5">Plan / Amount</th>
                    <th className="p-3.5">Reference Number</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No payment submissions found.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => {
                      const isOld = sub.created_date && now - new Date(sub.created_date).getTime() > 24 * 60 * 60 * 1000;
                      return (
                        <tr key={sub.id} className="hover:bg-muted/30">
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-mono text-muted-foreground">{formatDubaiTime(sub.created_date)}</span>
                            {isOld && sub.status === 'pending_verification' && (
                              <span className="block text-[10px] text-rose-600 font-bold">&gt;24h pending</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-foreground">{sub.business_name || sub.customer_name || 'N/A'}</p>
                            <p className="text-[11px] text-muted-foreground">{sub.email} • {sub.phone}</p>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <p className="font-semibold">{sub.plan_name}</p>
                            <p className="text-[11px] text-muted-foreground">{sub.price_label}</p>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <code className="rounded bg-muted px-2 py-1 font-mono font-bold text-foreground">
                              {sub.reference_number || 'Awaiting input'}
                            </code>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              sub.status === 'verified' ? 'bg-emerald-500/15 text-emerald-600' :
                              sub.status === 'rejected' ? 'bg-rose-500/15 text-rose-600' :
                              sub.status === 'pending_verification' ? 'bg-amber-500/15 text-amber-600' :
                              'bg-slate-500/15 text-slate-600'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            {sub.status === 'pending_verification' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                  onClick={() => setApproveDialog({ open: true, submission: sub })}
                                >
                                  <Check className="h-3 w-3" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => setRejectDialog({ open: true, submissionId: sub.id, reason: '' })}
                                >
                                  <X className="h-3 w-3" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Coupons */}
      {tab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Generate 48-hour promotional coupon codes for trial clients.</p>
            <Button
              size="sm"
              onClick={() => setCouponDialog({ open: true, code: '', duration_hours: 48, max_redemptions: 1, valid_until: '' })}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Create Coupon Code
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Redemptions</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3.5 font-mono font-bold text-foreground text-sm">{c.code}</td>
                    <td className="p-3.5">{c.duration_hours || 48} hours</td>
                    <td className="p-3.5">
                      {c.redemption_count || 0} / {c.max_redemptions || 1}
                    </td>
                    <td className="p-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        c.is_active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-slate-500/15 text-slate-600'
                      }`}>
                        {c.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => handleToggleCoupon(c)}
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Plans */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Manage active subscription plans, pricing labels, and payment URLs.</p>
            <Button
              size="sm"
              onClick={() => setPlanDialog({
                open: true,
                plan: { name: '', price_label: '', amount: 2222, duration_days: 365, payment_url: '', is_active: true, sort_order: 1 }
              })}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Plan
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-base">{p.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.is_active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-slate-500/15 text-slate-600'
                  }`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-extrabold text-2xl text-foreground">{p.price_label}</span>
                  <span className="text-muted-foreground ml-1">({p.duration_days} days)</span>
                </div>
                <div className="text-xs text-muted-foreground break-all">
                  <span className="font-semibold text-foreground">Checkout URL: </span>
                  <a href={p.payment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {p.payment_url}
                  </a>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => setPlanDialog({ open: true, plan: { ...p } })}
                >
                  Edit Plan
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Audit Log */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Immutable record of administrator actions and status modifications.</p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Admin Email</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Target Entity</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                      {formatDubaiTime(log.created_date)}
                    </td>
                    <td className="p-3.5 font-semibold text-foreground">{log.user_email || log.user_id}</td>
                    <td className="p-3.5">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5">{log.entity_name} ({log.entity_id})</td>
                    <td className="p-3.5 text-muted-foreground text-[11px] font-mono max-w-xs truncate">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(o) => setApproveDialog({ open: o, submission: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment Approval</DialogTitle>
            <DialogDescription>
              Approving this payment will verify reference{' '}
              <strong className="text-foreground">{approveDialog.submission?.reference_number}</strong> and extend the business subscription by{' '}
              <strong className="text-foreground">{approveDialog.submission?.duration_days || 365} days</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setApproveDialog({ open: false, submission: null })}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove}>
              Verify & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog({ open: o, submissionId: null, reason: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment Submission</DialogTitle>
            <DialogDescription>
              Provide an official reason for rejection. The user will be notified and provisional access will end.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rej-reason">Rejection Reason</Label>
            <Input
              id="rej-reason"
              placeholder="e.g., Reference number not found in bank ledger"
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog((prev) => ({ ...prev, reason: e.target.value }))}
              required
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRejectDialog({ open: false, submissionId: null, reason: '' })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Coupon Dialog */}
      <Dialog open={couponDialog.open} onOpenChange={(o) => setCouponDialog((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Promotional Coupon</DialogTitle>
            <DialogDescription>
              Coupons grant free access for a set duration (e.g., 48 hours) upon redemption.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCoupon} className="space-y-4 py-2">
            <div>
              <Label>Coupon Code (Uppercase)</Label>
              <Input
                placeholder="PROMO48"
                value={couponDialog.code}
                onChange={(e) => setCouponDialog((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                required
              />
            </div>
            <div>
              <Label>Duration (Hours)</Label>
              <Input
                type="number"
                value={couponDialog.duration_hours}
                onChange={(e) => setCouponDialog((p) => ({ ...p, duration_hours: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Max Redemptions</Label>
              <Input
                type="number"
                value={couponDialog.max_redemptions}
                onChange={(e) => setCouponDialog((p) => ({ ...p, max_redemptions: e.target.value }))}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Create Coupon</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Plan Dialog */}
      <Dialog open={planDialog.open} onOpenChange={(o) => setPlanDialog({ open: o, plan: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{planDialog.plan?.id ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
          </DialogHeader>
          {planDialog.plan && (
            <form onSubmit={handleSavePlan} className="space-y-3 py-2">
              <div>
                <Label>Plan Name</Label>
                <Input
                  value={planDialog.plan.name}
                  onChange={(e) => setPlanDialog((p) => ({ ...p, plan: { ...p.plan, name: e.target.value } }))}
                  required
                />
              </div>
              <div>
                <Label>Price Label</Label>
                <Input
                  value={planDialog.plan.price_label}
                  onChange={(e) => setPlanDialog((p) => ({ ...p, plan: { ...p.plan, price_label: e.target.value } }))}
                  required
                />
              </div>
              <div>
                <Label>Amount (AED)</Label>
                <Input
                  type="number"
                  value={planDialog.plan.amount}
                  onChange={(e) => setPlanDialog((p) => ({ ...p, plan: { ...p.plan, amount: e.target.value } }))}
                  required
                />
              </div>
              <div>
                <Label>Duration (Days)</Label>
                <Input
                  type="number"
                  value={planDialog.plan.duration_days}
                  onChange={(e) => setPlanDialog((p) => ({ ...p, plan: { ...p.plan, duration_days: e.target.value } }))}
                  required
                />
              </div>
              <div>
                <Label>Payment Checkout URL</Label>
                <Input
                  value={planDialog.plan.payment_url}
                  onChange={(e) => setPlanDialog((p) => ({ ...p, plan: { ...p.plan, payment_url: e.target.value } }))}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit">Save Plan</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
