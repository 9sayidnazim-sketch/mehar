import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { computeAccessState } from '../../shared/access.js';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;

    try {
      user = await base44.auth.me();
    } catch (e) {
      // Unauthenticated
      return Response.json({
        ok: false,
        authenticated: false,
        access: {
          state: 'none',
          allowed: false,
          badge: 'Sign In Required',
          reason: 'Authentication required'
        }
      }, { status: 401 });
    }

    const svc = base44.asServiceRole;
    const businessId = user.business_id || 'default_business';

    const access = await computeAccessState(businessId, user, svc);

    return Response.json({
      ok: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.name || '',
        role: user.role,
        business_id: businessId
      },
      access
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
