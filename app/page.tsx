import { hasWarehouseAccess } from '../lib/warehouse-access';
import Dashboard from './dashboard';
import {redirect} from 'next/navigation';
import {SessionKeepAlive} from './session-controls';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if(!await hasWarehouseAccess())redirect('/login');
  return <><SessionKeepAlive/><Dashboard /></>;
}
