import {hasWarehouseAccess} from '../../lib/warehouse-access';
import Inventory from './inventory';
import {redirect} from 'next/navigation';
import {SessionKeepAlive} from '../session-controls';
export const dynamic='force-dynamic';
export default async function InventoryPage(){
  if(!await hasWarehouseAccess())redirect('/login?next=/inventory');
  return <><SessionKeepAlive/><Inventory/></>;
}
