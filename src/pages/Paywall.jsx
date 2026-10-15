import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Sparkles, Check, Zap, Clock, Key,
  ExternalLink, AlertCircle, RefreshCw, CreditCard, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/mehar-utils';

export default function Paywall() {
  const { toast } = useToast();
  const [plans, setPlans] = useState({
    yearly: { label: 'Yearly Pro', amount: 2222, period: '1 year' },
    lifetime: { label: 'Lifetime Perpetual', amount: 3200, period: 'Lifetime' }
  });
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [checkingOut, setCheckingOut] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('costdesk_license_token') : null;
    if (!token) {
      setLicenseStatus({ active: false, message: 'No active license token found' });
      setLoadingStatus(false);
      return;
    }
    try {
      const res = await fetch(`/api/access?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      setLicenseStatus(data);
    } catch (e) {
      setLicenseStatus({ active: false, error: e.message });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Fetch live pricing
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.plans) setPlans(cfg.plans);
      })
      .catch(() => {});
  }, []);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      toast({ title: 'Enter a coupon code', variant: 'destructive' });
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch('/api/coupon/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('costdesk_license_token', data.token);
        toast({
          title: 'Trial Pass Activated!',
          description: `Enjoy full access for 48 hours (${data.remaining_hours || 48}h remaining).`
        });
        setCouponCode('');
        fetchStatus();
      } else {
        toast({
          title: 'Redemption Failed',
          description: data.error || 'Invalid or expired coupon code',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Network Error',
        description: err.message || 'Could not connect to licensing server',
        variant: 'destructive'
      });
    } finally {
      setRedeeming(false);
    }
  };

  const handleCheckout = async (planKey) => {
    setCheckingOut(planKey);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planKey,
          customer_name: 'THREDO Business User',
          customer_email: 'contact@octapus.ae'
        })
      });
      const data = await res.json();
      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast({
          title: 'Checkout Initialization',
          description: data.error || 'Payment gateway could not be loaded. Try again.',
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
      setCheckingOut(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 lg:p-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> OCTAPUS Enterprise License & Paywall
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Upgrade Your Tailoring Business
        </h1>
        <p className="text-sm text-muted-foreground">
          Unlock the complete THREDO Point of Sale, automated WhatsApp tax invoices, measurement specs, and multi-device cloud synchronization.
        </p>
      </div>

      {/* Active License Status Banner */}
      <div className="card-shadow rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md ${
              licenseStatus?.allowed ? 'bg-emerald-600 shadow-emerald-500/25' : 'bg-amber-600 shadow-amber-500/25'
            }`}>
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">Current License Status</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  licenseStatus?.allowed
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  {licenseStatus?.allowed ? 'Active' : 'Unlicensed / Trial Needed'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {licenseStatus?.allowed
                  ? `Plan: ${licenseStatus.plan || 'Active Pass'} (${licenseStatus.remaining_hours ? `${licenseStatus.remaining_hours}h remaining` : 'Permanent'})`
                  : 'Activate a plan below or redeem a 48-Hour Coupon Pass.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loadingStatus} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`} /> Check Status
            </Button>
            <a href="/paywall.html" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Full Paywall View
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Yearly Plan */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className="card-shadow flex flex-col justify-between rounded-2xl border border-border bg-card p-6 relative overflow-hidden"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                {plans.yearly?.label || 'Yearly Plan'}
              </span>
              <span className="text-xs text-muted-foreground line-through">AED 6,000/yr</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{formatCurrency(plans.yearly?.amount || 2222)}</span>
                <span className="text-sm font-medium text-muted-foreground">/ year</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Billed annually. Full business access.</p>
            </div>
            <ul className="space-y-2.5 text-xs text-foreground pt-2 border-t border-border">
              {[
                'Full THREDO POS & Retail sales system',
                'Custom tailoring orders & measurement specs',
                'Official PDF & WhatsApp invoice generator',
                'Cash, Card, & Ziina payment recording',
                'Offline-first with cross-tab live synchronization',
                'Standard email support'
              ].map((feat, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-6">
            <Button
              className="w-full h-11 font-semibold gap-2"
              onClick={() => handleCheckout('yearly')}
              disabled={checkingOut === 'yearly'}
            >
              <CreditCard className="h-4 w-4" />
              {checkingOut === 'yearly' ? 'Connecting Ziina...' : `Get Yearly Access (${formatCurrency(plans.yearly?.amount || 2222)})`}
            </Button>
          </div>
        </motion.div>

        {/* Lifetime Plan */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className="card-shadow flex flex-col justify-between rounded-2xl border-2 border-primary bg-gradient-to-br from-card via-card to-violet-500/5 p-6 relative overflow-hidden"
        >
          <div className="absolute right-4 top-4">
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-[10px] font-extrabold uppercase text-white shadow-sm">
              Best Value • One-Time
            </span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-violet-600 text-white px-2.5 py-1 text-xs font-bold">
                {plans.lifetime?.label || 'Lifetime Plan'}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-primary">{formatCurrency(plans.lifetime?.amount || 3200)}</span>
                <span className="text-sm font-medium text-muted-foreground">one-time</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Perpetual lifetime license. Zero monthly fees.</p>
            </div>
            <ul className="space-y-2.5 text-xs text-foreground pt-2 border-t border-border">
              {[
                'Everything in the Yearly Plan',
                'Lifetime perpetual software license',
                'Zero recurring charges ever',
                'Direct Ziina OIDC account integration',
                'All future feature updates & major releases',
                'Priority VIP support & setup assistance'
              ].map((feat, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="font-medium">{feat}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-6">
            <Button
              className="w-full h-11 font-semibold gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-violet-500/25"
              onClick={() => handleCheckout('lifetime')}
              disabled={checkingOut === 'lifetime'}
            >
              <Zap className="h-4 w-4" />
              {checkingOut === 'lifetime' ? 'Connecting Ziina...' : `Get Lifetime Deal (${formatCurrency(plans.lifetime?.amount || 3200)})`}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* 48-Hour Coupon Pass Redemption */}
      <div className="card-shadow rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-md">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-foreground">Redeem 48-Hour Free Trial Pass</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Have an official promo pass or admin coupon? Enter your code below to instantly activate 48 hours of unrestricted access.
            </p>
          </div>
          <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="CD-XXXX-XXXX"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="font-mono uppercase sm:w-60 h-10"
              required
            />
            <Button type="submit" disabled={redeeming} className="gap-2 h-10">
              <Key className="h-3.5 w-3.5" />
              {redeeming ? 'Redeeming...' : 'Activate Pass'}
            </Button>
          </form>
        </div>
      </div>

      {/* Ziina Direct Gateway & Security Footer */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-center text-xs text-muted-foreground space-y-2">
        <div className="flex items-center justify-center gap-2 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span>Encrypted Payment Processing by Ziina Payment Gateway (UAE Licensed)</span>
        </div>
        <p>
          Payments are handled securely via Ziina with automatic instant token issuance. Need admin coupon generation? Visit the{' '}
          <a href="/admin.html" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
            Admin Console
          </a>.
        </p>
      </div>
    </div>
  );
}
