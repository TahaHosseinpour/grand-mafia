import type { Metadata, Viewport } from 'next';
import { lalezar, vazirmatn } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'هیتلر ناشناس',
  applicationName: 'هیتلر ناشناس (Secret Hitler)',
  description: 'نسخه آنلاین بازی رومیزی استنتاج اجتماعی «هیتلر ناشناس». همیشه رایگان و بدون تبلیغ.',
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
  themeColor: '#3a1c12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} ${lalezar.variable}`}>
      <body className="bg-ink">{children}</body>
    </html>
  );
}
