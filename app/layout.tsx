/**
 * Wraps every route with global styles, metadata and the shared theme provider.
 * The early theme script runs before interactive rendering so the initial page can use the
 * saved/system theme.
 */

import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ExperienceProvider from '@/components/experience/ExperienceProvider';
import '@fontsource-variable/manrope';

/** Browser title/description supplied through Next.js rather than each page's rendered content. */
export const metadata: Metadata = {
  title: "Ladles of Love | Community Portal",
  description: "Volunteer opportunities, corporate volunteering and community impact with Ladles of Love.",
  icons: {
    icon: [
      { url: '/favicon.ico?v=heart-ladle', type: 'image/x-icon' },
      { url: '/ladles-tab-icon.png?v=heart-ladle', type: 'image/png', sizes: '256x256' },
    ],
    shortcut: '/favicon.ico?v=heart-ladle',
    apple: '/Ladles-logo.png',
  },
};

/** Wraps every route. The early script reads the saved/system theme before interactive components start. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><Script id="theme-initializer" strategy="beforeInteractive">{`try { const saved = localStorage.getItem('ladles-theme'); const theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = theme; } catch {}`}</Script></head>
      <body style={{ margin: 0, padding: 0, boxSizing: "border-box" }}>
        <ThemeProvider><ExperienceProvider>{children}</ExperienceProvider></ThemeProvider>
      </body>
    </html>
  );
}
