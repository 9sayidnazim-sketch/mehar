import { db } from '@/api/base44Client';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';

import { formatCurrency } from '@/lib/mehar-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/StatusBadge';

export default function QuickActionDialog({ action, onClose }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!action || !action.pick) return undefined;
    let alive = true;
    setItems(null);
    setSearch('');
    (async () => {
      try {
        const data = action.pick === 'customer'
          ? await db.entities.Customer.list('-created_date', 100)
          : await db.entities.Order.list('-created_date', 100);
        if (alive) setItems(data.filter((x) => action.pick !== 'order' || x.status !== 'Cancelled'));
      } catch (e) {
        console.error(e);
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, [action]);

  if (!action) return null;

  const q = search.trim().toLowerCase();
  const filtered = (items || []).filter((x) => {
    if (!q) return true;
    const hay = action.pick === 'customer'
      ? `${x.name || ''} ${x.phone || ''}`
      : `${x.order_id || ''} ${x.customer_name || ''} ${x.status || ''}`;
    return hay.toLowerCase().includes(q);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select {action.pick === 'customer' ? 'Customer' : 'Order'} — {action.label}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" autoFocus />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {items === null ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? (action.pick === 'customer' ? 'No customers yet. Add one from the Customers page.' : 'No orders yet.')
                : 'No matches.'}
            </p>
          ) : (
            filtered.map((x) => (
              <button
                key={x.id}
                onClick={() => { onClose(); navigate(action.pickTo(x)); }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {action.pick === 'customer' ? x.name : (x.order_id || x.id.slice(-6))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {action.pick === 'customer'
                      ? (x.phone || '—')
                      : `${x.customer_name || '—'} • Balance ${formatCurrency(Math.max(0, x.balance_due || 0))}`}
                  </p>
                </div>
                {action.pick === 'order' && <StatusBadge status={x.status} />}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}