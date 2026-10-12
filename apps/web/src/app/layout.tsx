import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fulcrum — Warehouse Fulfillment Simulation & Optimization',
  description: 'Simulation-first warehouse fulfillment optimization control tower',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-slate-100 min-h-screen antialiased flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
