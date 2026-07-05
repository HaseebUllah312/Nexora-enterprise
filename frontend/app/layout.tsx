import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';

export const metadata: Metadata = {
  title: 'Nexora Enterprise',
  description: 'Cloud ERP for PVC, PPRC & Sanitary Manufacturing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
