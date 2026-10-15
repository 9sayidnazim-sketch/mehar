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

    // Role check: non-admin gets 404 from the server
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { submission_id } = body;

    if (!submission_id) {
      return Response.json({ error: 'submission_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const submission = await svc.entities.PaymentSubmission.get(submission_id);

    if (!submission) {
      return Response.json({ error: 'Payment submission not found' }, { status: 404 });
    }

    // Single conditional update: only allowed from pending_verification (prevents double-click extensions)
    if (submission.status !== 'pending_verification') {
      return Response.json({
        error: `Cannot approve submission in state '${submission.status}'. Allowed only from 'pending_verification'.`
      }, { status: 409 });
    }

    const now = new Date();
    const durationDays = submission.duration_days || 365;
    const businessId = submission.business_id;

    // D7 Renewal Logic:
    // Check if business has an existing active subscription
    const existingSubs = await svc.entities.Subscription.filter({
      business_id: businessId,
      status: 'active'
    }, '-expires_at', 1);

    let startDate = now.toISOString();
    let baseTime = now.getTime();

    if (existingSubs && existingSubs.length > 0 && existingSubs[0].expires_at) {
      const existingExpiry = new Date(existingSubs[0].expires_at).getTime();
      if (existingExpiry > now.getTime()) {
        // Renewal extends from existing expiry!
        baseTime = existingExpiry;
        startDate = existingSubs[0].expires_at;
      }
    }

    const newExpiresAt = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Update submission to verified
    await svc.entities.PaymentSubmission.update(submission.id, {
      status: 'verified',
      verified_at: now.toISOString(),
      verified_by_user_id: user.id,
      updated_date: now.toISOString()
    });

    // 2. Create or extend Subscription
    let subscription = null;
    if (existingSubs && existingSubs.length > 0 && new Date(existingSubs[0].expires_at).getTime() > now.getTime()) {
      subscription = await svc.entities.Subscription.update(existingSubs[0].id, {
        plan_id: submission.plan_id,
        plan_name: submission.plan_name,
        expires_at: newExpiresAt,
        payment_submission_id: submission.id,
        updated_date: now.toISOString()
      });
    } else {
      subscription = await svc.entities.Subscription.create({
        business_id: businessId,
        plan_id: submission.plan_id,
        plan_name: submission.plan_name,
        status: 'active',
        start_date: startDate,
        expires_at: newExpiresAt,
        payment_submission_id: submission.id,
        created_date: now.toISOString()
      });
    }

    // 3. Create AccessGrant
    await svc.entities.AccessGrant.create({
      business_id: businessId,
      type: 'subscription',
      source_id: subscription.id,
      starts_at: startDate,
      expires_at: newExpiresAt,
      status: 'active',
      reason: `Verified payment reference ${submission.reference_number || submission.id}`
    });

    // 4. Audit Log
    await svc.entities.AuditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: 'approve_payment',
      entity_name: 'PaymentSubmission',
      entity_id: submission.id,
      details: JSON.stringify({
        business_id: businessId,
        reference_number: submission.reference_number,
        duration_days: durationDays,
        new_expires_at: newExpiresAt
      }),
      created_date: now.toISOString()
    });

    // 5. Notify user
    try {
      await svc.entities.AppNotification.create({
        business_id: businessId,
        user_id: submission.user_id,
        type: 'subscription_active',
        title: 'Payment Verified & Approved',
        message: `Your payment was verified. Subscription is active until ${newExpiresAt.slice(0, 10)}.`,
        dedupe_key: `notif-verified-${submission.id}`,
        link: '/paywall',
        is_read: false,
        created_date: now.toISOString()
      });
    } catch (e) {}

    return Response.json({
      ok: true,
      message: 'Payment approved successfully. Subscription extended.',
      submission_id: submission.id,
      status: 'verified',
      expires_at: newExpiresAt
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
