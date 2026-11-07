import { hasWarehouseAccess } from '../lib/warehouse-access';
import Dashboard from './dashboard';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if(!await hasWarehouseAccess())return <main className="access-notice"><h1>Open your protected dashboard</h1><p>Use the warehouse dashboard’s Vercel address and sign in with your authorized Vercel account.</p></main>;
  return <Dashboard />;
}
