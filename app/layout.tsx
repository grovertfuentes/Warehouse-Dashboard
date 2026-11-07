import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Warehouse Calendar | The Event Rental Guys',
  description: 'Warehouse schedule, two weeks of advance totals, and upcoming rental inventory for The Event Rental Guys.',
  icons: { icon: '/brand/terg-logo.png' },
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
