import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { computeAccessState } from '../../shared/access.js';

// In-memory rate limiter per user/IP: 5 failed attempts per 15 minutes
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { allowed: boolean; waitMinutes?: number } {
  const now = Date.now();
  const record = failedAttempts.get(key);
  if (!record) return { allowed: true };
  if (now > record.resetAt) {
    failedAttempts.delete(key);
    return { allowed: true };
  }
  if (record.count >= 5) {
    const waitMinutes = Math.ceil((record.resetAt - now) / 60000);
    return { allowed: false, waitMinutes };
  }
  return { allowed: true };
}

function recordFailure(key: string) {
  const now = Date.now();
  const record = failedAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  record.count += 1;
  failedAttempts.set(key, record);
}

function clearFailure(key: string) {
  failedAttempts.delete(key);
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Sign in required to redeem a promotional pass' }, { status: 401 });
    }

    const rateKey = user.id || 'anonymous';
    const rateCheck = checkRateLimit(rateKey);
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Too many failed attempts. Please wait ${rateCheck.waitMinutes} minutes before trying again.`
      }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = body.code || '';
    const cleanCode = String(rawCode).trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 4 || cleanCode.length > 32) {
      recordFailure(rateKey);
      return Response.json({ error: 'Coupon code must be between 4 and 32 characters.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const businessId = user.business_id || `biz-${user.id}`;

    // D8: Check if business already has current access (coupons do not stack)
    const currentAccess = await computeAccessState(businessId, user, svc);
    if (currentAccess.allowed && currentAccess.state !== 'none') {
      return Response.json({
        error: 'Your business already has active access. Coupons cannot be stacked on an active plan.'
      }, { status: 400 });
    }

    // Lookup coupon
    const coupons = await svc.entities.Coupon.filter({ code: cleanCode }, '-created_date', 1);
    if (!coupons || coupons.length === 0) {
      recordFailure(rateKey);
      return Response.json({ error: 'Invalid coupon code.' }, { status: 404 });
    }

    const coupon = coupons[0];

    // Check active
    if (coupon.is_active === false) {
      recordFailure(rateKey);
      return Response.json({ error: 'This coupon code is currently inactive.' }, { status: 400 });
    }

    const now = new Date();
    // Check expiry
    if (coupon.valid_until && new Date(coupon.valid_until).getTime() <= now.getTime()) {
      recordFailure(rateKey);
      return Response.json({ error: 'This coupon code has expired.' }, { status: 400 });
    }

    // Check max redemptions
    const maxRedemptions = coupon.max_redemptions || 1;
    const currentRedemptions = coupon.redemption_count || 0;
    if (currentRedemptions >= maxRedemptions) {
      recordFailure(rateKey);
      return Response.json({ error: 'This coupon has reached its maximum redemptions.' }, { status: 400 });
    }

    // Check if already used by this business (unique on coupon_id + business_id)
    const priorRedemptions = await svc.entities.CouponRedemption.filter({
      coupon_id: coupon.id,
      business_id: businessId
    }, '-created_date', 1);

    if (priorRedemptions && priorRedemptions.length > 0) {
      recordFailure(rateKey);
      return Response.json({ error: 'Your business has already redeemed this coupon code.' }, { status: 400 });
    }

    // Atomic transaction simulation:
    // Update count
    await svc.entities.Coupon.update(coupon.id, {
      redemption_count: currentRedemptions + 1
    });

    const durationHours = coupon.duration_hours || 48;
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

    // Insert CouponRedemption
    const redemption = await svc.entities.CouponRedemption.create({
      coupon_id: coupon.id,
      coupon_code: cleanCode,
      business_id: businessId,
      user_id: user.id,
      redeemed_at: now.toISOString(),
      expires_at: expiresAt
    });

    // Create AccessGrant record
    await svc.entities.AccessGrant.create({
      business_id: businessId,
      type: 'coupon',
      source_id: redemption.id,
      starts_at: now.toISOString(),
      expires_at: expiresAt,
      status: 'active',
      reason: `Redeemed coupon ${cleanCode}`
    });

    // Create Notification
    try {
      await svc.entities.AppNotification.create({
        business_id: businessId,
        user_id: user.id,
        type: 'coupon_applied',
        title: 'Coupon Pass Activated',
        message: `48-hour access pass activated with code ${cleanCode}.`,
        dedupe_key: `notif-coupon-${redemption.id}`,
        link: '/paywall',
        is_read: false,
        created_date: now.toISOString()
      });
    } catch (e) {}

    clearFailure(rateKey);

    return Response.json({
      ok: true,
      message: `Coupon redeemed successfully! Access granted for ${durationHours} hours.`,
      code: cleanCode,
      duration_hours: durationHours,
      expires_at: expiresAt
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
