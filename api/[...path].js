export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';

  // Auth login
  if (url.includes('/auth/login')) {
    return res.status(200).json({
      access_token: 'token-' + Date.now(),
      user: {
        id: 'usr-admin-gm',
        email: 'gm@octapus.ae',
        full_name: 'General Manager',
        role: 'admin',
        business_id: 'biz-default'
      }
    });
  }

  // Auth me
  if (url.includes('/auth/me')) {
    return res.status(200).json({
      id: 'usr-admin-gm',
      email: 'gm@octapus.ae',
      full_name: 'General Manager',
      role: 'admin',
      business_id: 'biz-default'
    });
  }

  // Functions getAccessState
  if (url.includes('getAccessState')) {
    const access = {
      state: 'admin',
      allowed: true,
      badge: 'Admin',
      badgeVariant: 'admin',
      role: 'admin',
      business_id: 'biz-default',
      expires_at: null,
      expires_formatted: 'Permanent (Platform Admin)',
      plan: 'System Admin'
    };
    return res.status(200).json({ data: { access }, access });
  }

  // Functions getNotifications
  if (url.includes('getNotifications')) {
    return res.status(200).json({
      data: { notifications: [], unread_count: 0 },
      notifications: [],
      unread_count: 0
    });
  }

  // Functions getOnlineOrderingConfig
  if (url.includes('getOnlineOrderingConfig')) {
    return res.status(200).json({
      data: { enabled: true, paused: false, business_id: 'biz-default' }
    });
  }

  // Route to sendSaleBill or sendWhatsAppInvoice if matched via catch-all
  if (url.includes('sendSaleBill')) {
    const sendSaleBill = (await import('./functions/sendSaleBill.js')).default;
    return sendSaleBill(req, res);
  }

  if (url.includes('sendWhatsAppInvoice')) {
    const sendWhatsAppInvoice = (await import('./functions/sendWhatsAppInvoice.js')).default;
    return sendWhatsAppInvoice(req, res);
  }

  // Route to whatsapp status or qr
  if (url.includes('/whatsapp/status')) {
    const statusHandler = (await import('./whatsapp/status.js')).default;
    return statusHandler(req, res);
  }

  if (url.includes('/whatsapp/qr')) {
    const qrHandler = (await import('./whatsapp/qr.js')).default;
    return qrHandler(req, res);
  }

  return res.status(200).json({ success: true });
}
