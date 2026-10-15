import React, { useEffect, useState } from 'react';
import { db } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ShieldCheck, Sparkles, Check, Key, RefreshCw, CreditCard, Lock, ArrowRight, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

const DEFAULT_PLANS = [
  {
    id: 'plan_yearly',
    name: 'Yearly Pro',
    price_label: 'AED 2,222 / year',
    amount: 2222,
    duration_days: 365,
    payment_url: 'https://pay.ziina.com/mehar/yearly',
    is_active: true,
    features: [
      'Full Tailoring POS & order pipelines',
      'Automated A4 PDF & WhatsApp invoices',
      'Multi-garment measurement templates',
      'Workshop & tailor allocation tracking',
      'Customer accounts & credit balances',
      'Priority UAE phone & email support'
    ]
  },
  {
    id: 'plan_lifetime',
    name: 'Lifetime Perpetual',
    price_label: 'AED 3,200 one-time',
    amount: 3200,
    duration_days: 36500,
    payment_url: 'https://pay.ziina.com/mehar/lifetime',
    is_active: true,
    features: [
      'Everything in Yearly Pro',
      'Lifetime perpetual license (zero renewal fees)',
      'Unlimited customer orders and sales',
      'Online ordering customer storefront (/order-online)',
      'Free software updates & major releases',
      'Dedicated onboarding & tailoring setup'
    ]
  }
];

export default function Paywall() {
  const { user, accessState, refreshAccessState, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Plans
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Form details
  const [fullName, setFullName] = useState(user?.full_name || user?.name || '');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Reference submission modal / box
  const [activeSubmissionId, setActiveSubmissionId] = useState(
    searchParams.get('submission_id') || localStorage.getItem('thredo_active_submission_id') || ''
  );
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      setLoading(true);
      try {
        const list = await db.entities.SubscriptionPlan.list('sort_order', 10);
        const active = (list || []).filter((p) => p.is_active && p.payment_url && p.duration_days);
        if (active.length > 0) {
          setPlans(active);
          setSelectedPlan(active[0]);
        } else {
          setPlans(DEFAULT_PLANS);
          setSelectedPlan(DEFAULT_PLANS[0]);
        }
      } catch (e) {
        setPlans(DEFAULT_PLANS);
        setSelectedPlan(DEFAULT_PLANS[0]);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(user.full_name || user.name || '');
      if (!email) setEmail(user.email || '');
      if (!phone) setPhone(user.phone || '');
    }
  }, [user]);

  // Initiate PayNow
  const handlePayNow = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast({ title: 'Sign In Required', description: 'Please sign in or create an account first.', variant: 'destructive' });
      navigate('/login?returnTo=/paywall');
      return;
    }

    if (!selectedPlan) {
      toast({ title: 'Select a Plan', description: 'Please choose an active plan option.', variant: 'destructive' });
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast({ title: 'Missing Information', description: 'Please fill in all your details.', variant: 'destructive' });
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await db.functions.invoke('initiatePayment', {
        plan_id: selectedPlan.id,
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });

      const data = res.data || res;
      if (data.ok && data.submission_id && data.redirect_url) {
        // Save submission id locally so user can enter reference upon return
        localStorage.setItem('thredo_active_submission_id', data.submission_id);
        setActiveSubmissionId(data.submission_id);

        toast({
          title: 'Redirecting to Payment Gateway',
          description: 'Complete your payment, then enter your transaction reference.'
        });

        // Redirect in the same tab per requirement 6c
        setTimeout(() => {
          window.location.href = data.redirect_url;
        }, 300);
      } else {
        toast({
          title: 'Payment Initialization Failed',
          description: data.error || 'Could not initiate payment session.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Payment service error',
        variant: 'destructive'
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Submit Reference
  const handleSubmitReference = async (e) => {
    e.preventDefault();
    const cleanRef = referenceNumber.trim();
    if (!cleanRef) {
      toast({ title: 'Reference Required', description: 'Please enter your payment receipt reference.', variant: 'destructive' });
      return;
    }

    if (!/^[A-Za-z0-9_-]{6,64}$/.test(cleanRef)) {
      toast({
        title: 'Invalid Reference Format',
        description: 'Reference must be 6 to 64 characters containing letters, digits, hyphens or underscores.',
        variant: 'destructive'
      });
      return;
    }

    if (!activeSubmissionId) {
      toast({ title: 'No Submission Found', description: 'Please select a plan and click PayNow first.', variant: 'destructive' });
      return;
    }

    setSubmittingRef(true);
    try {
      const res = await db.functions.invoke('submitPaymentReference', {
        submission_id: activeSubmissionId,
        reference_number: cleanRef
      });

      const data = res.data || res;
      if (data.ok) {
        toast({
          title: 'Reference Submitted!',
          description: '48-hour provisional access is now active under verification.'
        });
        setReferenceNumber('');
        localStorage.removeItem('thredo_active_submission_id');
        setActiveSubmissionId('');
        await refreshAccessState();
        navigate('/');
      } else {
        toast({
          title: 'Submission Failed',
          description: data.error || 'Failed to submit payment reference.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Network error while submitting reference',
        variant: 'destructive'
      });
    } finally {
      setSubmittingRef(false);
    }
  };

  // Redeem Coupon
  const handleRedeemCoupon = async (e) => {
    e.preventDefault();
    const clean = couponCode.trim().toUpperCase();
    if (!clean) {
      toast({ title: 'Enter a Coupon Code', variant: 'destructive' });
      return;
    }

    if (!isAuthenticated) {
      toast({ title: 'Sign In Required', description: 'Please sign in to redeem a coupon code.', variant: 'destructive' });
      navigate('/login?returnTo=/paywall');
      return;
    }

    setRedeemingCoupon(true);
    try {
      const res = await db.functions.invoke('redeemCoupon', { code: clean });
      const data = res.data || res;

      if (data.ok) {
        toast({
          title: 'Coupon Pass Activated!',
          description: data.message || '48-hour unrestricted access granted.'
        });
        setCouponCode('');
        await refreshAccessState();
        navigate('/');
      } else {
        toast({
          title: 'Coupon Refusal',
          description: data.error || 'Could not redeem this coupon.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Coupon redemption error',
        variant: 'destructive'
      });
    } finally {
      setRedeemingCoupon(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 lg:p-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> THREDO Single-Link Access & Licensing
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          Tailoring & Retail Enterprise Suite
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time measurement records, A4 PDF tax invoices, POS sales register, and multi-user workshop tracking.
        </p>
      </div>

      {/* Access Status Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md ${
              accessState?.allowed
                ? accessState.state === 'provisional' ? 'bg-amber-600 shadow-amber-500/25' : 'bg-emerald-600 shadow-emerald-500/25'
                : 'bg-rose-600 shadow-rose-500/25'
            }`}>
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">License Status</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  accessState?.allowed
                    ? accessState.state === 'provisional' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                }`}>
                  {accessState?.badge || 'Unlicensed'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {accessState?.reason ? accessState.reason :
                 accessState?.allowed ? `Access active: ${accessState.expires_formatted || 'Current'}` :
                 'Choose a plan below or redeem a 48-Hour Promotional Pass.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAccessState} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Check Status
            </Button>
            {accessState?.allowed && (
              <Button size="sm" onClick={() => navigate('/')} className="gap-1.5 text-xs bg-primary">
                Open App <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active Submission Reference Input Box */}
      {activeSubmissionId && (
        <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/5 p-6 shadow-md space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-foreground text-sm">Payment Initiated — Enter Reference</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                After completing your payment on the gateway, paste your transaction receipt / reference number below to instantly unlock 48-hour provisional access.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmitReference} className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <Input
              placeholder="e.g. TXN-984210"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="font-mono uppercase bg-background"
              required
            />
            <Button type="submit" disabled={submittingRef} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
              {submittingRef ? 'Submitting...' : 'Confirm Reference'}
            </Button>
          </form>
        </div>
      )}

      {/* Two Plan Options */}
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((p) => {
          const isSelected = selectedPlan?.id === p.id;
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPlan(p)}
              className={`flex flex-col justify-between rounded-2xl border-2 p-6 transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'border-primary bg-card shadow-lg ring-2 ring-primary/20'
                  : 'border-border bg-card/60 hover:border-primary/50'
              }`}
            >
              {p.duration_days > 365 && (
                <div className="absolute right-4 top-4">
                  <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-sm">
                    Best Value
                  </span>
                </div>
              )}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'
                  }`}>
                    {p.name}
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">{p.price_label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.duration_days >= 36500 ? 'Perpetual lifetime software license' : 'Annual commercial license'}
                  </p>
                </div>
                <ul className="space-y-2 text-xs text-foreground pt-3 border-t border-border">
                  {(p.features || DEFAULT_PLANS.find((d) => d.name === p.name)?.features || [
                    'Point of Sale & custom tailoring records',
                    'Tax invoices with PDF & WhatsApp dispatch',
                    '48-hour provisional access guarantee'
                  ]).map((feat, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-6">
                <Button
                  variant={isSelected ? 'default' : 'outline'}
                  className="w-full h-11 font-semibold"
                  onClick={(e) => { e.stopPropagation(); setSelectedPlan(p); }}
                >
                  {isSelected ? 'Selected Plan' : 'Select Plan'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Your Details & PayNow Form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="border-b border-border pb-4 mb-5">
          <h2 className="text-base font-bold text-foreground">Complete Your Details & PayNow</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selected: <strong className="text-foreground">{selectedPlan?.name || 'Yearly Pro'}</strong> ({selectedPlan?.price_label}). All fields validated on server.
          </p>
        </div>

        <form onSubmit={handlePayNow} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pn-fullname">Full Name</Label>
              <Input
                id="pn-fullname"
                placeholder="e.g. Alex Hunter"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="pn-bizname">Business Name</Label>
              <Input
                id="pn-bizname"
                placeholder="e.g. Mehar Bespoke Tailors"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pn-email">Email Address</Label>
              <Input
                id="pn-email"
                type="email"
                placeholder="you@company.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="pn-phone">Phone Number (UAE / International)</Label>
              <Input
                id="pn-phone"
                placeholder="050 123 4567 or +971501234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Numbers starting with 05 automatically normalized to +971.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={submittingPayment}
              className="w-full sm:w-auto h-11 px-8 font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {submittingPayment ? 'Connecting Payment Gateway...' : `PayNow — ${selectedPlan?.price_label || 'Proceed'}`}
            </Button>
          </div>
        </form>
      </div>

      {/* 48-Hour Coupon Pass Redemption */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-md">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">Redeem 48-Hour Promotional Coupon Pass</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Have a trial coupon code from an administrator? Enter it below to unlock 48 hours of full app access.
            </p>
          </div>
          <form onSubmit={handleRedeemCoupon} className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="e.g. PROMO48"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="font-mono uppercase sm:w-60 h-10 bg-background"
              required
            />
            <Button type="submit" disabled={redeemingCoupon} className="gap-2 h-10">
              <Key className="h-3.5 w-3.5" />
              {redeemingCoupon ? 'Verifying...' : 'Redeem Pass'}
            </Button>
          </form>
        </div>
      </div>

      {/* Security Footer */}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-center text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center justify-center gap-2 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span>Server-Enforced Access Control • Verified UAE Gateways</span>
        </div>
        <p className="text-[11px]">
          Provisional access activates immediately upon payment reference submission. All transactions audited and verified.
        </p>
      </div>
    </div>
  );
}
