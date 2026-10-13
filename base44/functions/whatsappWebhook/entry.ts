import { secrets } from "base44:runtime";

// WhatsApp webhook endpoint (Meta Cloud API / 360dialog compatible).
// GET  -> verification handshake (echoes hub.challenge when the verify token matches).
// POST -> incoming messages & delivery status callbacks (acknowledges 200 immediately).
export default async function whatsappWebhook(req) {
  try {
    const url = new URL(req.url);
    const method = (req.method || "GET").toUpperCase();

    // 1) Verification handshake
    if (method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const expected = secrets.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
      if (mode === "subscribe" && expected && token === expected) {
        return new Response(challenge ?? "", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response("Forbidden", { status: 403 });
    }

    // 2) Incoming events
    if (method === "POST") {
      const body = await req.json().catch(() => null);
      if (body && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            const value = change.value || {};
            const bizPhone = value.metadata?.display_phone_number || "unknown";
            for (const m of value.messages || []) {
              const from = m.from || bizPhone;
              console.log("WhatsApp incoming:", from, m.type, JSON.stringify(m).slice(0, 600));
            }
            for (const s of value.statuses || []) {
              console.log("WhatsApp status:", s.id, s.status, s.timestamp, s.recipient_id || "");
            }
          }
        }
      }
      // WhatsApp requires a fast 200 ack or it retries.
      return Response.json({ received: true });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("whatsappWebhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}