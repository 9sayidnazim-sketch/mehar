import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { computeAccessState } from '../../shared/access.js';

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    if (!body || !body.type || !body.customer) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const customer = body.customer || {};
    if (!customer.name || !customer.phone) {
      return Response.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    // Load config + company
    const [configs, companies] = await Promise.all([
      svc.entities.WebsiteConfig.list('-created_date', 1),
      svc.entities.Company.list('-created_date', 5),
    ]);
    const config = configs[0];
    if (!config || config.enabled === false) {
      return Response.json({ error: 'Online ordering is currently disabled' }, { status: 403 });
    }

    const company = companies.find((c: any) => c.is_default) || companies[0] || null;
    const businessId = company?.id || 'default_business';

    // D4: Access check on business
    const access = await computeAccessState(businessId, null, svc);
    if (!access.allowed) {
      return Response.json({ error: 'This store is temporarily paused and cannot accept online orders.' }, { status: 403 });
    }

    const autoAccept = config.auto_accept === true;

    // Find or create customer by phone
    let cust = null;
    const existing = await svc.entities.Customer.filter({ phone: customer.phone });
    if (existing && existing.length > 0) cust = existing[0];
    if (!cust) {
      cust = await svc.entities.Customer.create({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        whatsapp: customer.whatsapp || '',
        address: customer.address || '',
        city: customer.city || '',
        status: 'active',
        business_id: businessId
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();

    if (body.type === 'tailoring') {
      const t = body.tailoring || {};
      const orderId = 'ORD-' + ref;
      await svc.entities.Order.create({
        order_id: orderId,
        business_id: businessId,
        customer_id: cust.id,
        customer_name: cust.name,
        booking_date: today,
        delivery_date: t.delivery_date || '',
        priority: 'Normal',
        order_type: 'Standard',
        status: 'Booked',
        template_name: t.garment_type || '',
        measurement_values: t.measurements || {},
        fabric_type: t.fabric_preference || '',
        style_notes: t.notes || '',
        delivery_method: customer.delivery_method || 'Pickup',
        remarks: 'Submitted via website',
        source: 'online',
        online_pending: !autoAccept,
      });
      return Response.json({ ok: true, reference: orderId, review: !autoAccept });
    } else if (body.type === 'retail') {
      const items = (body.retail && body.retail.items) || [];
      if (items.length === 0) {
        return Response.json({ error: 'Cart is empty' }, { status: 400 });
      }
      const subtotal = items.reduce(
        (s: number, i: any) => s + (i.line_total || (i.price * i.quantity)),
        0
      );
      const saleId = 'SAL-' + ref;
      await svc.entities.Sale.create({
        sale_id: saleId,
        business_id: businessId,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        customer_email: cust.email || '',
        items: items.map((i: any) => ({
          product_id: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          line_total: i.line_total || i.price * i.quantity,
        })),
        subtotal,
        total: subtotal,
        amount_paid: 0,
        balance_due: subtotal,
        payment_status: 'Pending',
        payment_method: 'Cash',
        date: today,
        status: 'Completed',
        notes: (body.retail && body.retail.notes) || 'Submitted via website',
        source: 'online',
        online_pending: !autoAccept,
      });
      return Response.json({ ok: true, reference: saleId, review: !autoAccept });
    } else {
      return Response.json({ error: 'Unknown order type' }, { status: 400 });
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}