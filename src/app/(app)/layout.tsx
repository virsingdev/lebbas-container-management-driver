'use client';
import { GeofenceProvider } from '@/components/GeofenceMonitor';
import { Providers } from '@/components/Providers';
import { Shell } from '@/components/Shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <GeofenceProvider>
        <Shell>{children}</Shell>
      </GeofenceProvider>
    </Providers>
  );
}
