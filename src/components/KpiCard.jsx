import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function KpiCard({ label, value, icon: Icon, trend, accent = 'primary', index = 0 }) {
  const iconTint = {
    primary: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
    accent: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    warning: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
    danger: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-300',
    blue: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  };

  const barColor = {
    primary: 'bg-violet-500',
    accent: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    blue: 'bg-blue-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="card-shadow relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className={cn('absolute inset-x-0 top-0 h-1', barColor[accent])} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-[1.65rem] font-bold leading-none tracking-tight">{value}</p>
          {trend && <p className="mt-2 text-xs text-muted-foreground">{trend}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconTint[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}