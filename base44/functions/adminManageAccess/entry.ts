import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

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
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const svc = base44.asServiceRole;
    const now = new Date();

    if (action === 'grant_days') {
      const { business_id, days, reason } = body;
      if (!business_id || !days || days <= 0) {
        return Response.json({ error: 'business_id and positive days required' }, { status: 400 });
      }

      const existingSubs = await svc.entities.Subscription.filter({
        business_id,
        status: 'active'
      }, '-expires_at', 1);

      let baseTime = now.getTime();
      let startDate = now.toISOString();
      if (existingSubs.length > 0 && new Date(existingSubs[0].expires_at).getTime() > now.getTime()) {
        baseTime = new Date(existingSubs[0].expires_at).getTime();
        startDate = existingSubs[0].expires_at;
      }

      const newExpiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

      if (existingSubs.length > 0 && new Date(existingSubs[0].expires_at).getTime() > now.getTime()) {
        await svc.entities.Subscription.update(existingSubs[0].id, {
          expires_at: newExpiresAt,
          updated_date: now.toISOString()
        });
      } else {
        await svc.entities.Subscription.create({
          business_id,
          plan_name: 'Admin Grant',
          status: 'active',
          start_date: startDate,
          expires_at: newExpiresAt,
          created_date: now.toISOString()
        });
      }

      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        action: 'admin_grant_days',
        entity_name: 'Business',
        entity_id: business_id,
        details: JSON.stringify({ days, reason, newExpiresAt }),
        created_date: now.toISOString()
      });

      return Response.json({ ok: true, message: `Granted ${days} days access.`, new_expires_at: newExpiresAt });
    }

    if (action === 'revoke') {
      const { business_id, reason } = body;
      if (!business_id) {
        return Response.json({ error: 'business_id required' }, { status: 400 });
      }

      const subs = await svc.entities.Subscription.filter({ business_id, status: 'active' });
      for (const s of subs) {
        await svc.entities.Subscription.update(s.id, {
          status: 'expired',
          expires_at: now.toISOString(),
          updated_date: now.toISOString()
        });
      }

      const grants = await svc.entities.AccessGrant.filter({ business_id, status: 'active' });
      for (const g of grants) {
        await svc.entities.AccessGrant.update(g.id, {
          status: 'revoked',
          expires_at: now.toISOString()
        });
      }

      const submissions = await svc.entities.PaymentSubmission.filter({ business_id, status: 'pending_verification' });
      for (const p of submissions) {
        await svc.entities.PaymentSubmission.update(p.id, {
          status: 'rejected',
          rejection_reason: reason || 'Access revoked by administrator'
        });
      }

      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        action: 'admin_revoke_access',
        entity_name: 'Business',
        entity_id: business_id,
        details: JSON.stringify({ reason }),
        created_date: now.toISOString()
      });

      try {
        await svc.entities.AppNotification.create({
          business_id,
          type: 'access_revoked',
          title: 'Access Revoked',
          message: reason ? `Access was revoked: ${reason}` : 'Access was revoked by administrator.',
          dedupe_key: `notif-revoked-${business_id}-${Date.now()}`,
          link: '/paywall',
          is_read: false,
          created_date: now.toISOString()
        });
      } catch (e) {}

      return Response.json({ ok: true, message: 'Access revoked successfully.' });
    }

    if (action === 'create_coupon') {
      const { code, duration_hours, max_redemptions, valid_until } = body;
      const cleanCode = String(code || '').trim().toUpperCase();
      if (!cleanCode || cleanCode.length < 4 || cleanCode.length > 32) {
        return Response.json({ error: 'Code must be 4-32 characters' }, { status: 400 });
      }

      const existing = await svc.entities.Coupon.filter({ code: cleanCode });
      if (existing.length > 0) {
        return Response.json({ error: 'Coupon code already exists' }, { status: 400 });
      }

      const coupon = await svc.entities.Coupon.create({
        code: cleanCode,
        duration_hours: Number(duration_hours) || 48,
        max_redemptions: Number(max_redemptions) || 1,
        redemption_count: 0,
        valid_until: valid_until || null,
        is_active: true,
        created_by_user_id: user.id,
        created_date: now.toISOString()
      });

      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        action: 'admin_create_coupon',
        entity_name: 'Coupon',
        entity_id: coupon.id,
        details: JSON.stringify(coupon),
        created_date: now.toISOString()
      });

      return Response.json({ ok: true, coupon });
    }

    if (action === 'toggle_coupon') {
      const { coupon_id, is_active } = body;
      const updated = await svc.entities.Coupon.update(coupon_id, { is_active });
      return Response.json({ ok: true, coupon: updated });
    }

    if (action === 'save_plan') {
      const { id, name, price_label, amount, duration_days, payment_url, is_active, sort_order } = body;
      if (!name || !price_label || !duration_days || !payment_url) {
        return Response.json({ error: 'Missing required plan fields' }, { status: 400 });
      }

      let plan = null;
      if (id) {
        plan = await svc.entities.SubscriptionPlan.update(id, {
          name,
          price_label,
          amount: Number(amount) || 0,
          duration_days: Number(duration_days),
          payment_url,
          is_active: is_active !== false,
          sort_order: Number(sort_order) || 1
        });
      } else {
        plan = await svc.entities.SubscriptionPlan.create({
          name,
          price_label,
          amount: Number(amount) || 0,
          duration_days: Number(duration_days),
          payment_url,
          is_active: is_active !== false,
          sort_order: Number(sort_order) || 1
        });
      }

      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        action: 'admin_save_plan',
        entity_name: 'SubscriptionPlan',
        entity_id: plan.id,
        details: JSON.stringify(plan),
        created_date: now.toISOString()
      });

      return Response.json({ ok: true, plan });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
