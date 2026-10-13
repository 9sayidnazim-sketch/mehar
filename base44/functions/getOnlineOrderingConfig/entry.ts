const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = db.asServiceRole;

    const [configs, companies, products] = await Promise.all([
      svc.entities.WebsiteConfig.list('-created_date', 1),
      svc.entities.Company.list('-created_date', 5),
      svc.entities.Product.list('-created_date', 100),
    ]);

    const config = configs[0] || {
      enabled: false,
      auto_accept: false,
      title: '',
      tagline: '',
      garment_types: [],
      product_ids: [],
      contact_phone: '',
      contact_whatsapp: '',
    };

    const company = companies.find((c) => c.is_default) || companies[0] || null;
    const featuredIds = config.product_ids || [];
    const featured = (products || []).filter(
      (p) => featuredIds.includes(p.id) && p.is_active !== false
    );

    return Response.json({ config, company, products: featured });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}