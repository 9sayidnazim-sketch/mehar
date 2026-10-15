import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { computeAccessState } from '../../shared/access.js';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const [configs, companies, products] = await Promise.all([
      svc.entities.WebsiteConfig.list('-created_date', 1),
      svc.entities.Company.list('-created_date', 5),
      svc.entities.Product.list('-created_date', 100),
    ]);

    const company = companies.find((c: any) => c.is_default) || companies[0] || null;
    const businessId = company?.id || 'default_business';

    // D4: Verify if business has active access
    const access = await computeAccessState(businessId, null, svc);
    const isBusinessActive = access.allowed;

    const rawConfig = configs[0] || {
      enabled: true,
      auto_accept: false,
      title: 'THREDO Online Boutique',
      tagline: 'Bespoke tailoring and curated retail fabrics in Dubai.',
      garment_types: ['Emirati Kandora', 'Bespoke Suit', 'Formal Shirt', 'Trousers'],
      product_ids: [],
      contact_phone: '+971 52 872 4090',
      contact_whatsapp: '+971 52 872 4090',
    };

    const config = {
      ...rawConfig,
      enabled: isBusinessActive && rawConfig.enabled !== false,
      paused: !isBusinessActive
    };

    const featuredIds = config.product_ids || [];
    const featured = (products || []).filter(
      (p: any) => (featuredIds.length === 0 || featuredIds.includes(p.id)) && p.is_active !== false
    );

    return Response.json({
      data: {
        config,
        company,
        products: featured,
        access_active: isBusinessActive
      }
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}