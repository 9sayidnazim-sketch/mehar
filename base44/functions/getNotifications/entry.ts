import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ notifications: [], unreadCount: 0 });
    }

    const businessId = user.business_id || `biz-${user.id}`;
    const svc = base44.asServiceRole;

    // Check expiring warnings automatically on fetch
    try {
      const now = new Date();
      const subs = await svc.entities.Subscription.filter({ business_id: businessId, status: 'active' }, '-expires_at', 1);
      if (subs.length > 0 && subs[0].expires_at) {
        const diffMs = new Date(subs[0].expires_at).getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > 0 && diffHours <= 24) {
          const dedupeKey = `expiring-24h-${subs[0].id}`;
          const existing = await svc.entities.AppNotification.filter({ dedupe_key: dedupeKey });
          if (existing.length === 0) {
            await svc.entities.AppNotification.create({
              business_id: businessId,
              user_id: user.id,
              type: 'expiring_24h',
              title: 'Subscription Expiring Soon',
              message: 'Your subscription expires in less than 24 hours. Renew now to avoid interruption.',
              dedupe_key: dedupeKey,
              link: '/paywall',
              is_read: false,
              created_date: now.toISOString()
            });
          }
        } else if (diffHours > 24 && diffHours <= 72) {
          const dedupeKey = `expiring-72h-${subs[0].id}`;
          const existing = await svc.entities.AppNotification.filter({ dedupe_key: dedupeKey });
          if (existing.length === 0) {
            await svc.entities.AppNotification.create({
              business_id: businessId,
              user_id: user.id,
              type: 'expiring_72h',
              title: 'Subscription Renewal Reminder',
              message: 'Your subscription will expire in 3 days.',
              dedupe_key: dedupeKey,
              link: '/paywall',
              is_read: false,
              created_date: now.toISOString()
            });
          }
        }
      }
    } catch (e) {}

    const notifications = await svc.entities.AppNotification.filter({
      business_id: businessId
    }, '-created_date', 50);

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    return Response.json({
      ok: true,
      notifications,
      unreadCount
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
