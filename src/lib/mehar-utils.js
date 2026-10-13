export const STATUS_COLORS = {
  Booked: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Cutting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Stitching: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Quality Check': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Trial: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  Alteration: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const PRIORITY_COLORS = {
  Normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Rush: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Premium: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

export const PAYMENT_COLORS = {
  Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Pending: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function formatCurrency(amount, currency = 'AED') {
  const value = Number(amount || 0);
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}