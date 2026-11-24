import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
export const metadata: Metadata = {
  title: 'LEBBAS Container Driver', description: 'Container collection app for LEBBAS drivers', manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'LBS Container', statusBarStyle: 'black-translucent' }, icons: { apple: '/icons/apple-touch-icon.png', icon: '/icons/icon-192.png' },
};
export const viewport: Viewport = { themeColor: '#0F766E', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={inter.className}>{children}</body></html>;
}
