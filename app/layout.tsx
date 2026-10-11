/** Root page wrapper: global styles, page metadata and the shared light/dark theme provider. */
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";

/** Browser title/description supplied through Next.js rather than each page's rendered content. */
export const metadata: Metadata = {
  title: "Ladles of Love – Volunteer Portal",
  description: "Volunteer management platform for Ladles of Love NPO",
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
