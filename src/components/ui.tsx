'use client';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Inbox, TriangleAlert } from 'lucide-react';

export const cn = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

export function Btn({
  v = 'primary',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'primary' | 'ghost' | 'danger' | 'warn' }) {
  const s = {
    primary: 'bg-[#0F766E] text-white shadow-sm hover:bg-[#0D655E] active:scale-[0.99] active:bg-[#134E4A]',
    ghost: 'border border-slate-200 bg-white text-slate-800 shadow-xs hover:bg-slate-50 active:scale-[0.99] active:bg-slate-100',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.99] active:bg-red-800',
    warn: 'bg-amber-500 text-slate-950 shadow-sm hover:bg-amber-600 active:scale-[0.99] active:bg-amber-600',
  }[v];
  return (
    <button
      {...p}
      className={cn(
        'inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition disabled:pointer-events-none disabled:opacity-50',
        s,
        className
      )}
    />
  );
}

export const inputCls =
  'w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-[#0F766E] focus:bg-white focus:outline-none';

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm', className)}>{children}</div>
);

type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral';
const T: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
  bad: 'bg-red-50 text-red-700 ring-1 ring-red-200/80',
  warn: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',
  info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80',
};

export function toneOf(v: string): Tone {
  if (/^(completed|synced|active|succeeded|on duty|granted)$/.test(v.toLowerCase())) return 'ok';
  if (/^(failed|skipped|conflict|rejected|cancelled|denied)$/.test(v.toLowerCase())) return 'bad';
  if (/^(pending|planned|reported|syncing|prompt)$/.test(v.toLowerCase())) return 'warn';
  if (/^(en_route|arrived|in_progress|assigned)$/.test(v.toLowerCase())) return 'info';
  return 'neutral';
}

export const Badge = ({ children, tone }: { children: string; tone?: Tone }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', T[tone ?? toneOf(children)])}>
    {children.replace(/_/g, ' ')}
  </span>
);

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors',
        checked ? 'bg-[#0F766E]' : 'bg-slate-300'
      )}
    >
      <span
        className={cn(
          'inline-block h-6 w-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export const Skeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
    ))}
  </div>
);

export const Empty = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <Inbox size={20} aria-hidden />
    </span>
    <div>{children}</div>
    {action}
  </div>
);

export const ErrorBox = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    <TriangleAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
    <div className="flex-1">
      {error instanceof Error ? error.message : 'Could not load.'}
      {retry && (
        <button className="ml-2 font-semibold underline" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  </div>
);

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[1px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-[460px] overflow-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" />
        <h2 className="mb-4 text-xl font-bold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
