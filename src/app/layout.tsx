import type { Metadata, Viewport } from 'next';
import { vazirmatn } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'هیتلر مخفی',
  description: 'نسخه آنلاین بازی رومیزی استنتاج اجتماعی «هیتلر مخفی». همیشه رایگان و بدون تبلیغ.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#c36563',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>{children}</body>
    </html>
  );
}
