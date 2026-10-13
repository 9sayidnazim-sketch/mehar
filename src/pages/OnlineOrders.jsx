import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/mehar-utils';
import { Globe, Check, X, Package, ShoppingBag, Clock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function OnlineOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [o, s, c] = await Promise.all([
          db.entities.Order.filter({ source: 'online' }, { sort: '-created_date', limit: 200 }),
          db.entities.Sale.filter({ source: 'online' }, { sort: '-created_date', limit: 200 }),
          db.entities.WebsiteConfig.list('-created_date', 5),
        ]);
        setOrders(Array.isArray(o) ? o : (o?.items || []));
        setSales(Array.isArray(s) ? s : (s?.items || []));
        setConfig(c[0] || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pendingOrders = orders.filter((o) => o.online_pending && o.status !== 'Cancelled');
  const pendingSales = sales.filter((s) => s.online_pending && s.status !== 'Cancelled');
  const pendingCount = pendingOrders.length + pendingSales.length;
  const embedUrl = `${window.location.origin}/order-online`;

  const accept = async (kind, rec) => {
    setBusyId(rec.id);
    try {
      await db.entities[kind].update(rec.id, { online_pending: false });
      if (kind === 'Order') setOrders((p) => p.map((x) => (x.id === rec.id ? { ...x, online_pending: false } : x)));
      else setSales((p) => p.map((x) => (x.id === rec.id ? { ...x, online_pending: false } : x)));
      toast({ title: 'Order accepted' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to accept', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (kind, rec) => {
    setBusyId(rec.id);
    try {
      await db.entities[kind].update(rec.id, { online_pending: false, status: 'Cancelled' });
      if (kind === 'Order') setOrders((p) => p.map((x) => (x.id === rec.id ? { ...x, online_pending: false, status: 'Cancelled' } : x)));
      else setSales((p) => p.map((x) => (x.id === rec.id ? { ...x, online_pending: false, status: 'Cancelled' } : x)));
      toast({ title: 'Order rejected' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to reject', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Online Orders</h1>
          <p className="text-sm text-muted-foreground">Orders received from your public ordering page</p>
        </div>
        {config && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              navigator.clipboard?.writeText(embedUrl);
              toast({ title: 'Link copied' });
            }}
          >
            <Copy className="h-4 w-4" /> Copy public link
          </Button>
        )}
      </div>

      {config && (
        <div className="card-shadow flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${config.enabled ? 'bg-emerald-600' : 'bg-slate-400'}`}>
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ordering page is {config.enabled ? 'live' : 'offline'}</p>
              <p className="text-xs text-muted-foreground">Customers order at {embedUrl}</p>
            </div>
          </div>
          <a href={embedUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-2"><Globe className="h-4 w-4" /> Open page</Button>
          </a>
        </div>
      )}

      {/* Pending review */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold">Pending Review</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {pendingCount}
          </span>
        </div>
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : pendingCount === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No orders waiting for review.</p>
        ) : (
          <div className="space-y-2">
            {pendingOrders.map((o) => (
              <PendingRow
                key={o.id}
                icon={Package}
                title={o.order_id || o.id.slice(-6)}
                subtitle={`${o.customer_name} · Tailoring · ${o.style_notes || o.fabric_type || '—'}`}
                amount={o.total_amount}
                busy={busyId === o.id}
                onAccept={() => accept('Order', o)}
                onReject={() => reject('Order', o)}
              />
            ))}
            {pendingSales.map((s) => (
              <PendingRow
                key={s.id}
                icon={ShoppingBag}
                title={s.sale_id || s.id.slice(-6)}
                subtitle={`${s.customer_name || 'Customer'} · Retail · ${(s.items || []).length} item(s)`}
                amount={s.total}
                busy={busyId === s.id}
                onAccept={() => accept('Sale', s)}
                onReject={() => reject('Sale', s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Received tailoring orders */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Tailoring Orders ({orders.length})</h3>
        <TableOrEmpty count={orders.length} label="No online tailoring orders yet.">
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link to={`/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.order_id || o.id.slice(-6)}</Link>
              </td>
              <td className="px-4 py-3">{o.customer_name}</td>
              <td className="px-4 py-3">{formatDate(o.booking_date)}</td>
              <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
              <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.total_amount)}</td>
            </tr>
          ))}
        </TableOrEmpty>
      </div>

      {/* Received retail sales */}
      <div className="card-shadow rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Retail Sales ({sales.length})</h3>
        <TableOrEmpty count={sales.length} label="No online retail sales yet.">
          {sales.map((s) => (
            <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{s.sale_id || s.id.slice(-6)}</td>
              <td className="px-4 py-3">{s.customer_name || '—'}</td>
              <td className="px-4 py-3">{formatDate(s.date)}</td>
              <td className="px-4 py-3"><StatusBadge status={s.payment_status} /></td>
              <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.total)}</td>
            </tr>
          ))}
        </TableOrEmpty>
      </div>
    </div>
  );
}

function PendingRow({ icon: Icon, title, subtitle, amount, busy, onAccept, onReject }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white"><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{formatCurrency(amount)}</span>
        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={onAccept}>
          <Check className="h-3.5 w-3.5" /> Accept
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" disabled={busy} onClick={onReject}>
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}

function TableOrEmpty({ count, label, children }) {
  if (count === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Reference</th>
            <th className="px-4 py-2.5 font-medium">Customer</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}