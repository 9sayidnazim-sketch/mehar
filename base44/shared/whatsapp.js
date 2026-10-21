// Shared Orbit WhatsApp Gateway Client
// Orbit WhatsApp instance integration for PDF invoices

export async function checkOrbitStatus({ apiUrl, apiKey, timeoutMs = 10000 }) {
  const url = (apiUrl || 'https://orbit-35-154-242-129.sslip.io').replace(/\/+$/, '');
  const key = apiKey || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${url}/instance/status`, {
      method: 'GET',
      headers: {
        apikey: key,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));
    const isConnected = Boolean(data?.data?.Connected);
    const isLoggedIn = Boolean(data?.data?.LoggedIn);

    if (isConnected && isLoggedIn) {
      return { ok: true, connected: true, loggedIn: true, data: data.data };
    }

    return {
      ok: false,
      connected: isConnected,
      loggedIn: isLoggedIn,
      error: `Orbit WhatsApp instance is not ready (Connected: ${isConnected}, LoggedIn: ${isLoggedIn})`,
      details: data,
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      return { ok: false, timed_out: true, error: 'Result unknown—check before retrying' };
    }
    return { ok: false, error: err.message || 'Failed to check Orbit status' };
  }
}

export async function sendOrbitMediaDocument({
  apiUrl,
  apiKey,
  to,
  pdfBytes,
  fileName,
  caption,
  timeoutMs = 15000,
}) {
  const url = (apiUrl || 'https://orbit-35-154-242-129.sslip.io').replace(/\/+$/, '');
  const key = apiKey || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

  // Validate recipient: digits only, international format (8-15 digits)
  const cleanNumber = String(to || '').replace(/\D/g, '');
  if (cleanNumber.length < 8 || cleanNumber.length > 15) {
    return {
      ok: false,
      error: 'Invalid recipient number. Must include country code and contain 8 to 15 digits only.',
    };
  }

  // 1. Verify instance status before dispatching
  const statusCheck = await checkOrbitStatus({ apiUrl: url, apiKey: key });
  if (!statusCheck.ok) {
    return {
      ok: false,
      error: statusCheck.error || 'Orbit WhatsApp instance is not connected or logged in.',
      details: statusCheck.details,
    };
  }

  // 2. Prepare multipart/form-data payload
  // Let the HTTP client generate the multipart Content-Type boundary automatically
  const form = new FormData();
  form.append('number', cleanNumber);
  form.append('type', 'document');
  form.append('filename', fileName || 'invoice.pdf');
  form.append('caption', caption || '');

  const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  form.append('file', fileBlob, fileName || 'invoice.pdf');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${url}/send/media`, {
      method: 'POST',
      headers: {
        apikey: key,
      },
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: 'Failed',
        error: json.error || json.message || `Orbit API error (${res.status})`,
        details: json,
      };
    }

    // Extract message ID from response structure
    const messageId =
      json?.key?.id ||
      json?.messageId ||
      json?.id ||
      json?.data?.key?.id ||
      json?.data?.id ||
      json?.data?.messageId ||
      `orbit_${Date.now()}`;

    return {
      ok: true,
      status: 'Submitted',
      message_id: messageId,
      to: cleanNumber,
      gateway_response: json,
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.message?.includes('timeout') || err.name === 'TimeoutError') {
      return {
        ok: false,
        timed_out: true,
        error: 'Result unknown—check before retrying',
      };
    }
    return {
      ok: false,
      status: 'Failed',
      error: err.message || 'Network error while dispatching invoice via Orbit',
    };
  }
}

// Backwards-compatible helper supporting Base44 runtime secrets
export async function sendWhatsAppDocument({ secrets, to, pdfBytes, fileName, caption }) {
  const getSecret = (k) => {
    try {
      if (secrets && typeof secrets.get === 'function') {
        const v = secrets.get(k);
        if (v) return v;
      }
    } catch (_) {}
    if (typeof process !== 'undefined' && process.env && process.env[k]) {
      return process.env[k];
    }
    return null;
  };

  const apiUrl = getSecret('ORBIT_API_URL') || 'https://orbit-35-154-242-129.sslip.io';
  const apiKey = getSecret('ORBIT_INSTANCE_TOKEN') || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

  return sendOrbitMediaDocument({
    apiUrl,
    apiKey,
    to,
    pdfBytes,
    fileName,
    caption,
  });
}