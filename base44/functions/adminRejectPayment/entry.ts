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
    const { submission_id, reason } = body;

    if (!submission_id) {
      return Response.json({ error: 'submission_id is required' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return Response.json({ error: 'A specific rejection reason is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const submission = await svc.entities.PaymentSubmission.get(submission_id);

    if (!submission) {
      return Response.json({ error: 'Payment submission not found' }, { status: 404 });
    }

    const now = new Date();

    // Set to rejected, revoke provisional expiry
    await svc.entities.PaymentSubmission.update(submission.id, {
      status: 'rejected',
      rejection_reason: reason.trim(),
      provisional_expires_at: now.toISOString(),
      updated_date: now.toISOString()
    });

    // Write AuditLog
    await svc.entities.AuditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: 'reject_payment',
      entity_name: 'PaymentSubmission',
      entity_id: submission.id,
      details: JSON.stringify({
        business_id: submission.business_id,
        reason: reason.trim()
      }),
      created_date: now.toISOString()
    });

    // Notify user
    try {
      await svc.entities.AppNotification.create({
        business_id: submission.business_id,
        user_id: submission.user_id,
        type: 'payment_rejected',
        title: 'Payment Verification Rejected',
        message: `Your payment reference was rejected: ${reason.trim()}. You may submit a new reference.`,
        dedupe_key: `notif-rejected-${submission.id}`,
        link: '/paywall',
        is_read: false,
        created_date: now.toISOString()
      });
    } catch (e) {}

    return Response.json({
      ok: true,
      message: 'Payment submission rejected.',
      submission_id: submission.id,
      status: 'rejected',
      reason: reason.trim()
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
