import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

const REF_REGEX = /^[A-Za-z0-9_-]{6,64}$/;

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
      return Response.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { submission_id, reference_number } = body;

    if (!submission_id) {
      return Response.json({ error: 'submission_id is required' }, { status: 400 });
    }
    if (!reference_number || !REF_REGEX.test(reference_number.trim())) {
      return Response.json({
        error: 'Invalid reference format. Must be 6 to 64 characters containing letters, numbers, hyphens or underscores.'
      }, { status: 400 });
    }

    const cleanRef = reference_number.trim();
    const svc = base44.asServiceRole;

    // Check duplicate reference globally across all businesses (D9)
    const existingRef = await svc.entities.PaymentSubmission.filter({
      reference_number: cleanRef
    }, '-created_date', 2);

    if (existingRef && existingRef.length > 0 && existingRef[0].id !== submission_id) {
      return Response.json({
        error: 'This payment reference has already been submitted and cannot be reused.'
      }, { status: 400 });
    }

    const submission = await svc.entities.PaymentSubmission.get(submission_id);
    if (!submission) {
      return Response.json({ error: 'Payment submission record not found' }, { status: 404 });
    }

    const businessId = user.business_id || submission.business_id;
    if (submission.business_id !== businessId && user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized access to this payment submission' }, { status: 403 });
    }

    if (submission.status === 'verified') {
      return Response.json({ error: 'This payment has already been verified and approved.' }, { status: 400 });
    }

    const now = new Date();
    const provisionalHours = submission.provisional_access_hours || 48;
    const provisionalExpiresAt = new Date(now.getTime() + provisionalHours * 60 * 60 * 1000).toISOString();

    const updated = await svc.entities.PaymentSubmission.update(submission_id, {
      reference_number: cleanRef,
      status: 'pending_verification',
      provisional_expires_at: provisionalExpiresAt,
      updated_date: now.toISOString()
    });

    // Create AppNotification for user (T6)
    try {
      await svc.entities.AppNotification.create({
        business_id: businessId,
        user_id: user.id,
        type: 'payment_submitted',
        title: 'Payment Reference Submitted',
        message: `Reference ${cleanRef} received. Your account is active under 48-hour provisional verification.`,
        dedupe_key: `notif-paysub-${submission_id}`,
        link: '/paywall',
        is_read: false,
        created_date: now.toISOString()
      });
    } catch (notifErr) {
      console.warn('[Notification] Failed to create payment_submitted notification:', notifErr);
    }

    return Response.json({
      ok: true,
      message: 'Payment reference submitted successfully. Provisional access granted.',
      submission_id: updated.id,
      status: 'pending_verification',
      reference_number: cleanRef,
      provisional_expires_at: provisionalExpiresAt
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
