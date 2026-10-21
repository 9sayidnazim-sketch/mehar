import { checkOrbitStatus } from '../../base44/shared/whatsapp.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiUrl = (process.env.ORBIT_API_URL || 'https://orbit-35-154-242-129.sslip.io').replace(/\/+$/, '');
  const apiKey = process.env.ORBIT_INSTANCE_TOKEN || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

  try {
    // 1. Check current status
    const status = await checkOrbitStatus({ apiUrl, apiKey });

    if (status.loggedIn) {
      return res.status(200).json({
        ok: true,
        loggedIn: true,
        connected: true,
        name: status.name || status.data?.Name || 'Connected WhatsApp',
        message: 'WhatsApp instance is connected and logged in.',
        data: status.data,
      });
    }

    // 2. Fetch QR code from Orbit gateway
    const qrRes = await fetch(`${apiUrl}/instance/qr`, {
      method: 'GET',
      headers: {
        apikey: apiKey,
      },
    });

    const qrJson = await qrRes.json().catch(() => ({}));

    return res.status(200).json({
      ok: true,
      loggedIn: false,
      connected: Boolean(status.connected),
      qrcode: qrJson?.data?.qrcode || null,
      code: qrJson?.data?.code || null,
      status,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
