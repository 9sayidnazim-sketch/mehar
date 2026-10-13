// Shared WhatsApp Business API document sender.
// Auto-detects auth: 360dialog (D360-API-KEY) vs Meta Cloud API (Bearer) from the base URL.

export async function sendWhatsAppDocument({ secrets, to, pdfBytes, fileName, caption }) {
  const token = secrets.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = secrets.get('WHATSAPP_PHONE_NUMBER_ID');
  const baseUrl = (secrets.get('WHATSAPP_API_BASE_URL') || 'https://graph.facebook.com/v18.0').replace(/\/+$/, '');
  if (!token || !phoneId) {
    return {
      ok: false,
      error: 'WhatsApp credentials not configured. Add WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID (and optionally WHATSAPP_API_BASE_URL) in dashboard settings → environment variables.',
    };
  }
  const is360 = baseUrl.includes('360dialog');
  const authHeader = is360 ? { 'D360-API-KEY': token } : { Authorization: `Bearer ${token}` };

  // 1) Upload the PDF as media
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), fileName);
  const mediaRes = await fetch(`${baseUrl}/${phoneId}/media`, {
    method: 'POST',
    headers: authHeader,
    body: form,
  });
  const mediaJson = await mediaRes.json();
  if (!mediaJson.id) {
    return { ok: false, error: 'WhatsApp media upload failed', details: mediaJson };
  }

  // 2) Send the document message
  const msgRes = await fetch(`${baseUrl}/${phoneId}/messages`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { id: mediaJson.id, caption, filename: fileName },
    }),
  });
  const msgJson = await msgRes.json();
  if (!msgRes.ok) {
    return { ok: false, error: 'WhatsApp message send failed', details: msgJson };
  }
  return {
    ok: true,
    message_id: msgJson.messages && msgJson.messages[0] ? msgJson.messages[0].id : null,
    media_id: mediaJson.id,
    to,
  };
}