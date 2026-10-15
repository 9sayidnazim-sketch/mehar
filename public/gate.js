/**
 * Cost Desk Paywall Gatekeeper (gate.js)
 * Include in your Cost Desk application's HTML: <script src="/gate.js"></script>
 *
 * Protects routes by validating licenses against the server.
 * Automatically locks the app when a 48-hour coupon pass expires.
 */
(function () {
  'use strict';

  // Current page detection
  const currentPath = window.location.pathname.toLowerCase();
  const isPaywall = currentPath.includes('paywall.html');
  const isAdmin = currentPath.includes('admin.html');

  // Do not gate the paywall or admin console itself
  if (isPaywall || isAdmin) {
    return;
  }

  // Configuration
  const scriptTag = document.currentScript || document.querySelector('script[src*="gate.js"]');
  const paywallUrl = (scriptTag && scriptTag.getAttribute('data-paywall')) || '/paywall.html';
  const apiEndpoint = (scriptTag && scriptTag.getAttribute('data-api')) || '/api/access';
  const storageKey = (scriptTag && scriptTag.getAttribute('data-token-key')) || 'costdesk_license_token';

  function redirectToPaywall(reason) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    const param = reason ? `&reason=${encodeURIComponent(reason)}` : '';
    window.location.href = `${paywallUrl}?redirect=${returnUrl}${param}`;
  }

  const token = localStorage.getItem(storageKey);
  if (!token) {
    // Immediate redirect to prevent unauthorized content flash
    redirectToPaywall('no_license');
    return;
  }

  // Expose global controller
  window.CostDeskAccess = {
    token: token,
    active: false,
    plan: null,
    planLabel: null,
    expiresAt: null,
    remainingMs: null,
    logout: function () {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem('costdesk_cached_license');
      redirectToPaywall('logout');
    },
    checkAccess: verifyTokenWithServer
  };

  async function verifyTokenWithServer() {
    try {
      const res = await fetch(`${apiEndpoint}?token=${encodeURIComponent(token)}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        console.warn('[CostDesk Gate] Verification server responded with status:', res.status);
        return;
      }
      const data = await res.json();

      if (!data.active) {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem('costdesk_cached_license');
        redirectToPaywall('license_expired');
        return;
      }

      // Valid license
      window.CostDeskAccess.active = true;
      window.CostDeskAccess.plan = data.plan;
      window.CostDeskAccess.planLabel = data.planLabel;
      window.CostDeskAccess.expiresAt = data.expiresAt;
      window.CostDeskAccess.remainingMs = data.remainingMs;

      // Dispatch event for UI hooks
      window.dispatchEvent(
        new CustomEvent('costdesk:license-valid', {
          detail: data
        })
      );

      // If license has an expiration (e.g. 48h coupon pass), schedule automatic lock
      if (data.expiresAt) {
        const remaining = data.expiresAt - Date.now();
        if (remaining <= 0) {
          localStorage.removeItem(storageKey);
          redirectToPaywall('pass_expired');
        } else {
          // Schedule real-time app lock when expiration hits
          setTimeout(() => {
            alert('Your 48-hour access pass has expired. Redirecting to paywall...');
            localStorage.removeItem(storageKey);
            redirectToPaywall('pass_expired');
          }, remaining);
        }
      }
    } catch (err) {
      console.warn('[CostDesk Gate] Network error during token verification; permitting cached session', err);
    }
  }

  // Run validation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyTokenWithServer);
  } else {
    verifyTokenWithServer();
  }
})();
