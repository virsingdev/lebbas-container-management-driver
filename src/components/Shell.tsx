'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CloudOff, History, Home, Map, RefreshCw, Route, TriangleAlert, User, Wifi, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDriver } from './Providers';
import { cn } from './ui';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Home', icon: Home }, { href: '/route', label: 'My Route', icon: Route }, { href: '/map', label: 'Map', icon: Map },
  { href: '/history', label: 'History', icon: History }, { href: '/profile', label: 'Profile', icon: User }];

function StatusChip() {
  const { status: s } = useDriver();
  const [txt, cls, Icon] = s.attention > 0 ? [`${s.attention} need attention`, 'bg-red-100 text-red-800', TriangleAlert] as const
    : s.syncing ? ['Syncing…', 'bg-blue-100 text-blue-800', RefreshCw] as const
    : s.net === 'offline' ? [s.pending ? `Offline · ${s.pending} pending` : 'Offline', 'bg-slate-200 text-slate-800', CloudOff] as const
    : s.net === 'unreachable' ? [s.pending ? `Server unreachable · ${s.pending} pending` : 'Server unreachable', 'bg-amber-100 text-amber-900', CloudOff] as const
    : s.pending > 0 ? [`${s.pending} pending sync`, 'bg-amber-100 text-amber-900', RefreshCw] as const
    : ['Online · synced', 'bg-emerald-100 text-emerald-800', Wifi] as const;
  return <Link href="/history" role="status" className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', cls)}><Icon size={14} aria-hidden />{txt}</Link>;
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#134E4A] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white">
        <span className="text-lg font-bold tracking-wide">LEBBAS <span className="font-normal text-teal-200">Container Driver</span></span><StatusChip />
      </header>
      <main className="flex-1 space-y-4 p-4 pb-28">{children}</main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((t) => {
            const on = t.href === '/' ? path === '/' : path.startsWith(t.href) || (t.href === '/route' && path.startsWith('/stop'));
            return <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} className={cn('flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium', on ? 'text-[#0F766E]' : 'text-slate-500')}>
              <t.icon size={24} strokeWidth={on ? 2.5 : 2} aria-hidden />{t.label}</Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
