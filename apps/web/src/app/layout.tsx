import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fulcrum — Order-Specific Material Planning',
  description: 'Fast, personal order-fulfillment planning tool with offline stock observations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-bg-app text-text-primary min-h-screen antialiased flex flex-col font-sans transition-colors duration-150">
        {children}
      </body>
    </html>
  );
}
