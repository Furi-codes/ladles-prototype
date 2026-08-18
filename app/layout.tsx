import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ladles of Love – Volunteer Portal",
  description: "Volunteer management platform for Ladles of Love NPO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, boxSizing: "border-box" }}>
        {children}
      </body>
    </html>
  );
}