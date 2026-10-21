import { checkOrbitStatus } from '../../base44/shared/whatsapp.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const apiUrl = process.env.ORBIT_API_URL || 'https://orbit-35-154-242-129.sslip.io';
    const apiKey = process.env.ORBIT_INSTANCE_TOKEN || '98fbdc66-d18e-423b-a7bc-8e308fd00277';
    const status = await checkOrbitStatus({ apiUrl, apiKey });
    return res.status(200).json(status);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
