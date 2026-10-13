import { cn } from '@/lib/utils';

const COLOR_MAP = {
  // Order workflow — distinct hue per stage; final = solid fill
  Booked: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Cutting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Assigned: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  Stitching: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Quality Check': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Trial: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  Alteration: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Ready: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  Delivered: 'bg-emerald-600 text-white dark:bg-emerald-700',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  // Payment — neutral → partial → done
  Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  // Priority
  Normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Rush: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Premium: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  // Customer
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function StatusBadge({ status, className }) {
  const colorClass = COLOR_MAP[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colorClass, className)}>
      {status}
    </span>
  );
}