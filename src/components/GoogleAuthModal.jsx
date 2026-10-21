import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GoogleIcon from "@/components/GoogleIcon";
import { Shield, User, ArrowRight, Loader2 } from "lucide-react";

export default function GoogleAuthModal({ open, onOpenChange, returnTo = "/" }) {
  const [customEmail, setCustomEmail] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");

  const accounts = [
    {
      name: "General Manager",
      email: "gm@octapus.ae",
      role: "Platform Admin",
      isAdmin: true,
      avatarBg: "bg-emerald-600 text-white",
      initials: "GM"
    },
    {
      name: "OCTAPUS Store Account",
      email: "contact@octapus.ae",
      role: "Store Manager",
      isAdmin: true,
      avatarBg: "bg-blue-600 text-white",
      initials: "OS"
    }
  ];

  // Initialize official Google Identity Services if client ID is configured
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId && typeof window !== "undefined" && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              handleGoogleCredential(response.credential);
            }
          }
        });
      } catch (e) {
        console.warn("[GoogleAuth] GSI init error:", e);
      }
    }
  }, []);

  const handleGoogleCredential = (jwtToken) => {
    try {
      // Decode JWT payload (standard base64 payload segment)
      const base64Url = jwtToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const profile = JSON.parse(jsonPayload);
      completeGoogleSignIn(profile.email, profile.name || profile.email.split('@')[0], profile.picture);
    } catch (e) {
      console.error("[GoogleAuth] Failed to decode Google JWT:", e);
    }
  };

  const completeGoogleSignIn = (email, name, picture) => {
    setSigningIn(true);
    setSelectedEmail(email);

    const emailStr = String(email || '').toLowerCase();
    const isAdmin = emailStr.includes('octapus') || 
                    emailStr.includes('admin') || 
                    emailStr === 'gm@octapus.ae';

    const user = {
      id: `usr_google_${Date.now()}`,
      email: email,
      full_name: name || email.split('@')[0],
      role: isAdmin ? 'admin' : 'user',
      auth_provider: 'google',
      picture: picture || null,
      business_id: 'biz-default',
      created_date: new Date().toISOString()
    };

    const token = `google-auth-token-${Date.now()}`;
    localStorage.setItem('thredo_user', JSON.stringify(user));
    localStorage.setItem('base44_access_token', token);

    setTimeout(() => {
      onOpenChange(false);
      window.location.href = returnTo;
    }, 400);
  };

  const handleAccountSelect = (acc) => {
    completeGoogleSignIn(acc.email, acc.name);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) return;
    completeGoogleSignIn(customEmail, customEmail.split('@')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        <div className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white rounded-full shadow-sm border border-border/40">
              <GoogleIcon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                Sign in with Google
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Choose an account to continue to <span className="font-medium text-foreground">THREDO POS</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-4">
          {signingIn ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">
                Signing in with <span className="font-semibold text-primary">{selectedEmail}</span>...
              </p>
              <p className="text-xs text-muted-foreground">Redirecting to your dashboard</p>
            </div>
          ) : (
            <>
              {/* Account list */}
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleAccountSelect(acc)}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${acc.avatarBg}`}>
                        {acc.initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {acc.name}
                          </span>
                          {acc.isAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground block">{acc.email}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>

              {/* Use custom account */}
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/20 transition-all text-left text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center bg-muted/40">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span>Use another Google account</span>
                </button>
              ) : (
                <form onSubmit={handleCustomSubmit} className="space-y-3 p-4 rounded-xl border border-border bg-muted/20 animate-in fade-in-50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Google Email Address</label>
                    <Input
                      type="email"
                      placeholder="username@gmail.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="h-10 text-sm"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1 h-9 text-xs font-medium">
                      Continue with this account
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomInput(false)}
                      className="h-9 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {/* Terms notice */}
              <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  To continue, Google will share your name, email address, language preference, and profile picture with THREDO.
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
