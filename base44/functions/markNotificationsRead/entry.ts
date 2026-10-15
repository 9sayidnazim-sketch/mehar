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
      return Response.json({ error: 'Sign in required' }, { status: 401 });
    }

    const businessId = user.business_id || `biz-${user.id}`;
    const svc = base44.asServiceRole;

    const unread = await svc.entities.AppNotification.filter({
      business_id: businessId,
      is_read: false
    });

    for (const n of unread) {
      await svc.entities.AppNotification.update(n.id, { is_read: true });
    }

    return Response.json({ ok: true, marked: unread.length });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
