import {hasWarehouseAccess} from '../../lib/warehouse-access';
import Inventory from './inventory';
export const dynamic='force-dynamic';
export default async function InventoryPage(){
  if(!await hasWarehouseAccess())return <main className="access-notice"><h1>Open your protected dashboard</h1><p>Use the warehouse dashboard’s Vercel address to view inventory.</p></main>;
  return <Inventory/>;
}
