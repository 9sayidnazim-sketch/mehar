const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { secrets } from 'base44:runtime';

// WhatsApp webhook endpoint (Compatible with Orbit Evolution API & Meta Cloud API)
// GET  -> verification handshake
// POST -> incoming messages & confirmed delivery receipts
export default async function whatsappWebhook(req) {
  try {
    const url = new URL(req.url);
    const method = (req.method || 'GET').toUpperCase();

    // 1) Verification handshake
    if (method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      const expected = secrets.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || 'thredo_orbit_verify_token';
      if (mode === 'subscribe' && expected && token === expected) {
        return new Response(challenge ?? '', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new Response('OK', { status: 200 });
    }

    // 2) Incoming delivery status callbacks & events
    if (method === 'POST') {
      const body = await req.json().catch(() => null);

      if (body) {
        // Orbit Evolution API webhook format:
        // { event: "messages.update", data: [{ key: { id: "..." }, update: { status: 3 } }] }
        // Status 3 = DELIVERY_ACK (Delivered), 4 = READ (Read)
        const eventName = body.event || body.type;
        const eventData = body.data;

        if (eventName === 'messages.update' || eventName === 'message.update') {
          const updates = Array.isArray(eventData) ? eventData : [eventData].filter(Boolean);
          for (const u of updates) {
            const msgId = u?.key?.id || u?.id;
            const statusVal = u?.update?.status ?? u?.status;
            const isDelivered =
              statusVal === 3 ||
              statusVal === 4 ||
              String(statusVal).toUpperCase() === 'DELIVERY_ACK' ||
              String(statusVal).toUpperCase() === 'DELIVERED' ||
              String(statusVal).toUpperCase() === 'READ';

            if (msgId && isDelivered) {
              try {
                const sales = await db.asServiceRole.entities.Sale.filter({ whatsapp_message_id: msgId });
                if (sales && sales.length > 0) {
                  await db.asServiceRole.entities.Sale.update(sales[0].id, {
                    whatsapp_status: 'Delivered',
                  });
                }
              } catch (_) {}
            }
          }
        }

        // Standard Meta Cloud API webhook format:
        if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            for (const change of entry.changes || []) {
              const value = change.value || {};
              for (const s of value.statuses || []) {
                const isDelivered = s.status === 'delivered' || s.status === 'read';
                if (s.id && isDelivered) {
                  try {
                    const sales = await db.asServiceRole.entities.Sale.filter({ whatsapp_message_id: s.id });
                    if (sales && sales.length > 0) {
                      await db.asServiceRole.entities.Sale.update(sales[0].id, {
                        whatsapp_status: 'Delivered',
                      });
                    }
                  } catch (_) {}
                }
              }
            }
          }
        }
      }

      // Fast 200 acknowledgment
      return Response.json({ received: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}