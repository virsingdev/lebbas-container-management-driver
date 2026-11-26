'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CloudOff,
  History,
  Home,
  Map,
  Package,
  Radar,
  RefreshCw,
  Route,
  TriangleAlert,
  User,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useGeofence } from './GeofenceMonitor';
import { useDriver } from './Providers';
import { cn } from './ui';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/route', label: 'Route', icon: Route },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/history', label: 'History', icon: History },
  { href: '/profile', label: 'Profile', icon: User },
];

function StatusChip() {
  const { status: s } = useDriver();
  const [txt, cls, Icon] =
    s.attention > 0
      ? ([`${s.attention} issue${s.attention > 1 ? 's' : ''}`, 'bg-red-500/20 text-red-100 ring-1 ring-red-300/40', TriangleAlert] as const)
      : s.syncing
        ? (['Syncing…', 'bg-sky-400/20 text-sky-100 ring-1 ring-sky-300/40', RefreshCw] as const)
        : s.net === 'offline'
          ? ([s.pending ? `Offline · ${s.pending}` : 'Offline', 'bg-white/15 text-slate-100 ring-1 ring-white/20', CloudOff] as const)
          : s.net === 'unreachable'
            ? ([s.pending ? `Retry · ${s.pending}` : 'Server down', 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/40', CloudOff] as const)
            : s.pending > 0
              ? ([`${s.pending} pending`, 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/40', RefreshCw] as const)
              : (['Online', 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/40', Wifi] as const);

  return (
    <Link
      href="/history"
      role="status"
      className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur', cls)}
    >
      <Icon size={13} className={s.syncing ? 'animate-spin' : undefined} aria-hidden />
      <span>{txt}</span>
    </Link>
  );
}

function DetectorPill() {
  const { detectorState } = useGeofence();
  const active = detectorState === 'scanning' || detectorState === 'approaching' || detectorState === 'dwelled';
  const warn = detectorState === 'error' || detectorState === 'waiting_gps' || detectorState === 'low_accuracy';
  return (
    <Link
      href="/map"
      aria-label="Zero-scan detector status"
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
        active
          ? 'bg-teal-400/20 text-teal-100 ring-1 ring-teal-300/40'
          : warn
            ? 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40'
            : 'bg-white/10 text-teal-100/80 ring-1 ring-white/15'
      )}
    >
      <Radar size={12} className={active ? 'animate-pulse' : undefined} aria-hidden />
      <span>{detectorState === 'off' ? 'GPS Off' : active ? 'GPS Live' : warn ? 'GPS Wait' : 'GPS Ready'}</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col bg-[#F8FAFC] sm:border-x sm:border-slate-200/80 sm:shadow-2xl">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-r from-[#134E4A] to-[#0F766E] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white shadow-sm">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-teal-100 ring-1 ring-white/20">
            <Package size={19} aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-bold tracking-wide">LEBBAS</span>
            <span className="block text-[11px] font-medium text-teal-100/85">Container Driver</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <DetectorPill />
          <StatusChip />
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-32 pt-4">{children}</main>

      <nav
        aria-label="Main"
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[460px] -translate-x-1/2 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x"
      >
        <div className="grid grid-cols-5 px-1 py-1">
          {TABS.map((t) => {
            const on = t.href === '/' ? path === '/' : path.startsWith(t.href) || (t.href === '/route' && path.startsWith('/stop'));
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition',
                  on ? 'text-[#0F766E]' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition',
                    on ? 'bg-[#F0FDFA] text-[#0F766E]' : 'bg-transparent'
                  )}
                >
                  <t.icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden />
                </span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
