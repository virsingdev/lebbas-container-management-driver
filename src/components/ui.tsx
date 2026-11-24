'use client';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Inbox, TriangleAlert } from 'lucide-react';

export const cn = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');
export function Btn({ v = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'primary' | 'ghost' | 'danger' | 'warn' }) {
  const s = { primary: 'bg-[#0F766E] text-white active:bg-[#134E4A]', ghost: 'border-2 border-slate-200 bg-white text-slate-800 active:bg-slate-100', danger: 'bg-red-600 text-white active:bg-red-700', warn: 'bg-amber-500 text-slate-900 active:bg-amber-600' }[v];
  return <button {...p} className={cn('inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold disabled:opacity-50', s, className)} />;
}
export const inputCls = 'w-full min-h-[52px] rounded-xl border-2 border-slate-200 bg-white px-4 text-base';
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>;

type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral';
const T: Record<Tone, string> = { ok: 'bg-emerald-100 text-emerald-800', bad: 'bg-red-100 text-red-800', warn: 'bg-amber-100 text-amber-900', info: 'bg-blue-100 text-blue-800', neutral: 'bg-slate-100 text-slate-700' };
export function toneOf(v: string): Tone {
  if (/^(completed|synced|active|succeeded)$/.test(v)) return 'ok';
  if (/^(failed|skipped|conflict|rejected|cancelled)$/.test(v)) return 'bad';
  if (/^(pending|planned|reported|syncing)$/.test(v)) return 'warn';
  if (/^(en_route|arrived|in_progress|assigned)$/.test(v)) return 'info';
  return 'neutral';
}
export const Badge = ({ children, tone }: { children: string; tone?: Tone }) => <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize', T[tone ?? toneOf(children)])}>{children.replace(/_/g, ' ')}</span>;
export const Skeleton = ({ rows = 3 }: { rows?: number }) => <div className="space-y-3" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500"><Inbox aria-hidden />{children}</div>;
export const ErrorBox = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><TriangleAlert className="shrink-0" size={20} aria-hidden /><div>{error instanceof Error ? error.message : 'Could not load.'}{retry && <button className="ml-2 font-semibold underline" onClick={retry}>Retry</button>}</div></div>
);
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full overflow-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" /><h2 className="mb-4 text-xl font-bold">{title}</h2>{children}
      </div>
    </div>
  );
}
