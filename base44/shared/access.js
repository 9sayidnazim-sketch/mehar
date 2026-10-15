// Shared Access & Licensing Engine for THREDO (OCTAPUS)
// Enforces server-side access computation, UTC expiry, and Asia/Dubai time display.

export function formatDubaiTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export function formatDubaiDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export async function computeAccessState(businessId, user, svc) {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Priority: Platform Admin
  if (user && user.role === 'admin') {
    return {
      state: 'admin',
      allowed: true,
      badge: 'Admin',
      badgeVariant: 'admin',
      role: 'admin',
      business_id: businessId || user.business_id || 'system',
      expires_at: null,
      expires_formatted: 'Permanent (Platform Admin)',
      plan: 'System Admin'
    };
  }

  const effectiveBusinessId = businessId || user?.business_id;
  if (!effectiveBusinessId) {
    return {
      state: 'none',
      allowed: false,
      badge: 'Unregistered',
      badgeVariant: 'destructive',
      reason: 'No business profile attached to user.',
      expires_at: null
    };
  }

  // 2. Priority: Active Subscription
  try {
    const subs = await svc.entities.Subscription.filter({
      business_id: effectiveBusinessId,
      status: 'active'
    }, '-expires_at', 5);

    const activeSub = subs.find((s) => s.expires_at && s.expires_at > nowIso);
    if (activeSub) {
      // Check if a renewal is concurrently under verification
      let renewalUnderVerification = false;
      try {
        const pendingSubmissions = await svc.entities.PaymentSubmission.filter({
          business_id: effectiveBusinessId,
          status: 'pending_verification'
        }, '-created_date', 1);
        if (pendingSubmissions.length > 0) {
          renewalUnderVerification = true;
        }
      } catch (e) {}

      const formatted = formatDubaiDate(activeSub.expires_at);
      return {
        state: 'subscription',
        allowed: true,
        badge: `Active until ${formatted}`,
        badgeVariant: 'success',
        plan: activeSub.plan_name || 'Active Subscription',
        expires_at: activeSub.expires_at,
        expires_formatted: formatted,
        renewal_under_verification: renewalUnderVerification,
        subscription_id: activeSub.id
      };
    }
  } catch (err) {
    console.error('[AccessState] Error querying Subscription:', err);
  }

  // 3. Priority: Active Promotional Coupon (48-Hour Pass)
  try {
    const redemptions = await svc.entities.CouponRedemption.filter({
      business_id: effectiveBusinessId
    }, '-expires_at', 5);

    const activeCoupon = redemptions.find((r) => r.expires_at && r.expires_at > nowIso);
    if (activeCoupon) {
      const formatted = formatDubaiTime(activeCoupon.expires_at);
      const remainingMs = new Date(activeCoupon.expires_at).getTime() - now.getTime();
      const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));

      return {
        state: 'coupon',
        allowed: true,
        badge: `Coupon access until ${formatted}`,
        badgeVariant: 'coupon',
        plan: '48-Hour Promotional Pass',
        expires_at: activeCoupon.expires_at,
        expires_formatted: formatted,
        remaining_hours: remainingHours,
        coupon_id: activeCoupon.coupon_id
      };
    }
  } catch (err) {
    console.error('[AccessState] Error querying CouponRedemption:', err);
  }

  // 4. Priority: Provisional Access (Under Verification)
  try {
    const submissions = await svc.entities.PaymentSubmission.filter({
      business_id: effectiveBusinessId,
      status: 'pending_verification'
    }, '-created_date', 5);

    const activeProvisional = submissions.find(
      (s) => s.provisional_expires_at && s.provisional_expires_at > nowIso
    );

    if (activeProvisional) {
      const remainingMs = new Date(activeProvisional.provisional_expires_at).getTime() - now.getTime();
      const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
      return {
        state: 'provisional',
        allowed: true,
        badge: 'Under Verification',
        badgeVariant: 'warning',
        plan: activeProvisional.plan_name || 'Verification Pending',
        expires_at: activeProvisional.provisional_expires_at,
        expires_formatted: formatDubaiTime(activeProvisional.provisional_expires_at),
        remaining_hours: remainingHours,
        submission_id: activeProvisional.id,
        reference_number: activeProvisional.reference_number
      };
    }

    // Check if provisional expired without admin approval
    const expiredProvisional = submissions.find(
      (s) => s.provisional_expires_at && s.provisional_expires_at <= nowIso
    );
    if (expiredProvisional) {
      return {
        state: 'provisional_expired',
        allowed: false,
        badge: 'Verification Pending',
        badgeVariant: 'destructive',
        reason: 'Your 48-hour provisional access window has expired. Payment verification is still pending by admin review.',
        expires_at: expiredProvisional.provisional_expires_at,
        submission_id: expiredProvisional.id
      };
    }

    // Check if recent submission was explicitly rejected
    const rejectedSubmissions = await svc.entities.PaymentSubmission.filter({
      business_id: effectiveBusinessId,
      status: 'rejected'
    }, '-created_date', 1);

    if (rejectedSubmissions.length > 0) {
      const rej = rejectedSubmissions[0];
      return {
        state: 'rejected',
        allowed: false,
        badge: 'Payment Rejected',
        badgeVariant: 'destructive',
        reason: rej.rejection_reason || 'Payment submission was rejected during verification. You may submit a new payment reference.',
        submission_id: rej.id
      };
    }
  } catch (err) {
    console.error('[AccessState] Error querying PaymentSubmission:', err);
  }

  // 5. Fallback: No access / Expired
  return {
    state: 'none',
    allowed: false,
    badge: 'Unlicensed',
    badgeVariant: 'secondary',
    reason: 'No active subscription or trial pass found. Please choose a plan or redeem a 48-hour access pass.',
    expires_at: null
  };
}
