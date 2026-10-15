import React, { useEffect, useState, useCallback } from 'react';
import { db } from '@/api/base44Client';
import { Bell, CheckCheck, Clock, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationPopover() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await db.functions.invoke('getNotifications', {});
      const data = res.data || res;
      if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? data.notifications.filter((n) => !n.is_read).length);
      }
    } catch (e) {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);

    // Refresh on window focus
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await db.functions.invoke('markNotificationsRead', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('Failed to mark notifications read:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (notif) => {
    setOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-background animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-2xl rounded-2xl border-border bg-card text-card-foreground overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">Notifications</h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-violet-500/15 text-primary text-[10px] font-bold px-2 py-0.5">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={loading}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium">No notifications yet</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">You will receive subscription and payment alerts here.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id || n.dedupe_key}
                onClick={() => handleItemClick(n)}
                className={`p-3.5 transition-colors cursor-pointer hover:bg-muted/50 ${
                  !n.is_read ? 'bg-violet-500/5' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'subscription_active' ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    ) : n.type === 'payment_rejected' || n.type === 'access_revoked' ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-primary">
                        <Clock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${!n.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelativeTime(n.created_date)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/70 p-2.5 bg-muted/20 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setOpen(false); navigate('/paywall'); }}
            className="w-full h-8 text-xs font-semibold text-primary gap-1"
          >
            <span>Manage License & Paywall</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
