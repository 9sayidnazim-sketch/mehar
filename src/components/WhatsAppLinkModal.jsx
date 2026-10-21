import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  RefreshCw,
  QrCode,
  Smartphone,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function WhatsAppLinkModal({
  open,
  onOpenChange,
  onConnected,
  onSimulate,
}) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [codeUrl, setCodeUrl] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatusAndQr = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/qr');
      const data = await res.json();
      if (data.ok) {
        setStatus(data);
        if (data.qrcode) {
          setQrCodeData(data.qrcode);
        } else {
          setQrCodeData('/orbit-qr.png');
        }
        if (data.code) {
          setCodeUrl(data.code);
        }
        if (data.loggedIn && onConnected) {
          onConnected(data);
        }
      } else {
        // Fallback: check status endpoint
        const stRes = await fetch('/api/whatsapp/status');
        const stData = await stRes.json();
        setStatus(stData);
        setQrCodeData('/orbit-qr.png');
      }
    } catch (err) {
      console.warn('Could not fetch live WhatsApp QR, falling back to cached:', err);
      setQrCodeData('/orbit-qr.png');
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      const isLoggedIn = Boolean(data?.loggedIn || data?.data?.LoggedIn || data?.ok);
      setStatus(data);
      if (isLoggedIn) {
        if (onConnected) onConnected(data);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStatusAndQr();
      const interval = setInterval(() => {
        checkConnectionStatus();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const isLoggedIn = Boolean(status?.loggedIn || status?.data?.LoggedIn || (status?.ok && status?.connected && status?.loggedIn));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/20 text-[#25D366]">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                WhatsApp Gateway Setup
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pair your WhatsApp phone to send automated A4 PDF tax invoices
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Banner */}
          <div
            className={`flex items-center justify-between rounded-lg p-3 text-xs ${
              isLoggedIn
                ? 'border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                : 'border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-semibold">
                {isLoggedIn
                  ? 'Instance Logged In & Active'
                  : 'Instance Not Logged In'}
              </span>
            </div>
            <Badge
              variant={isLoggedIn ? 'default' : 'outline'}
              className={
                isLoggedIn
                  ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                  : 'border-amber-500 text-amber-700 dark:text-amber-300'
              }
            >
              {isLoggedIn ? 'Ready' : 'Scan Required'}
            </Badge>
          </div>

          {/* QR Code Section or Connected State */}
          {isLoggedIn ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="font-bold text-foreground text-sm">
                WhatsApp Linked Successfully!
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Invoices and sale bills will be dispatched with PDF documents attached directly to customer numbers.
              </p>
              {status?.name && (
                <p className="font-mono text-xs font-semibold text-primary">
                  Account: {status.name}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* QR Image Box */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white dark:bg-slate-950 p-4 shadow-inner">
                {loading && !qrCodeData ? (
                  <div className="flex h-56 w-56 items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center">
                    <img
                      src={qrCodeData || '/orbit-qr.png'}
                      alt="WhatsApp QR Code"
                      className="h-56 w-56 rounded-md object-contain"
                    />
                    <span className="mt-2 text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Smartphone className="h-3.5 w-3.5" />
                      Scan using WhatsApp on your phone
                    </span>
                  </div>
                )}
              </div>

              {/* Steps Guide */}
              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5 border border-border/60">
                <p className="font-semibold text-foreground text-[11px]">How to link:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                  <li>Open <strong>WhatsApp</strong> on your phone</li>
                  <li>Go to <strong>Settings</strong> (iOS) or <strong>Menu ⋮</strong> (Android)</li>
                  <li>Tap <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
                  <li>Point your phone camera at this QR code</li>
                </ol>
              </div>

              {codeUrl && (
                <div className="text-center pt-1">
                  <a
                    href={codeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Direct Device Pairing Link <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center">
          <div className="flex gap-2 w-full sm:w-auto">
            {!isLoggedIn && onSimulate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onSimulate();
                  onOpenChange(false);
                }}
                className="text-xs gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Simulate in Dev
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fetchStatusAndQr}
              disabled={loading || checking}
              className="text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${loading || checking ? 'animate-spin' : ''}`} />
              Refresh QR
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs"
          >
            {isLoggedIn ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
