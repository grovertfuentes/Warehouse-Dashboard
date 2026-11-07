import 'server-only';
import { headers } from 'next/headers';
import { warehouseAccessAllowed } from './warehouse-access.mjs';
export async function hasWarehouseAccess() {
  const h=await headers();
  return warehouseAccessAllowed({vercel:process.env.VERCEL,nodeEnv:process.env.NODE_ENV,protectionEnabled:process.env.WAREHOUSE_VERCEL_AUTH,host:h.get('host')});
}
