import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function AccessBadge({ className }) {
  const { accessState, user } = useAuth();

  if (!accessState) return null;

  const { state, badge, renewal_under_verification, badgeVariant } = accessState;

  const variantStyles = {
    admin: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    coupon: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    destructive: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    secondary: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
  };

  const currentVariant = badgeVariant || (
    state === 'admin' ? 'admin' :
    state === 'subscription' ? 'success' :
    state === 'coupon' ? 'coupon' :
    state === 'provisional' ? 'warning' : 'destructive'
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Link
        to="/paywall"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-transform hover:scale-102",
          variantStyles[currentVariant] || variantStyles.secondary
        )}
        title={accessState.reason || badge}
      >
        {state === 'subscription' ? (
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        ) : state === 'provisional' ? (
          <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
        ) : state === 'coupon' ? (
          <Sparkles className="h-3 w-3" />
        ) : (
          <ShieldCheck className="h-3 w-3" />
        )}
        <span>{badge || 'Checking...'}</span>
      </Link>

      {renewal_under_verification && (
        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
          Renewal under verification
        </span>
      )}
    </div>
  );
}
