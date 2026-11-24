'use client';
import { Providers } from '@/components/Providers';
import { Shell } from '@/components/Shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers><Shell>{children}</Shell></Providers>;
}
