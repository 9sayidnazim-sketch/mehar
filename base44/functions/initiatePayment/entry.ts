import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

function normalizeE164Phone(raw: string): string {
  if (!raw) return '';
  let digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.startsWith('05') && digits.length === 10) {
    return '+971' + digits.substring(1);
  }
  if (digits.startsWith('5') && digits.length === 9) {
    return '+971' + digits;
  }
  if (digits.startsWith('971') && digits.length >= 11) {
    return '+' + digits;
  }
  if (!digits.startsWith('+') && digits.length >= 8) {
    return '+' + digits;
  }
  return raw;
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
      return Response.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { plan_id, full_name, business_name, email, phone } = body;

    if (!plan_id) {
      return Response.json({ error: 'plan_id is required' }, { status: 400 });
    }
    if (!full_name || !full_name.trim()) {
      return Response.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email address is required' }, { status: 400 });
    }
    if (!phone || String(phone).replace(/[^0-9]/g, '').length < 8) {
      return Response.json({ error: 'Valid phone number is required (min 8 digits)' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const plan = await svc.entities.SubscriptionPlan.get(plan_id);
    if (!plan || plan.is_active === false) {
      return Response.json({ error: 'Selected plan is not currently active' }, { status: 400 });
    }
    if (!plan.payment_url || !plan.duration_days) {
      return Response.json({ error: 'Plan is misconfigured (missing payment_url or duration_days)' }, { status: 400 });
    }

    const normalizedPhone = normalizeE164Phone(phone);
    const businessId = user.business_id || `biz-${user.id}`;
    const idempotencyKey = `pay-${businessId}-${plan_id}-${Date.now()}`;

    // Create PaymentSubmission record in awaiting_payment state
    const submission = await svc.entities.PaymentSubmission.create({
      business_id: businessId,
      user_id: user.id,
      customer_name: full_name.trim(),
      business_name: (business_name || '').trim(),
      email: email.trim().toLowerCase(),
      phone: normalizedPhone,
      plan_id: plan.id,
      plan_name: plan.name,
      price_label: plan.price_label,
      amount: plan.amount || 0,
      duration_days: plan.duration_days,
      payment_url: plan.payment_url,
      status: 'awaiting_payment',
      idempotency_key: idempotencyKey,
      created_date: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      submission_id: submission.id,
      redirect_url: plan.payment_url,
      plan: {
        id: plan.id,
        name: plan.name,
        price_label: plan.price_label,
        duration_days: plan.duration_days
      }
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
