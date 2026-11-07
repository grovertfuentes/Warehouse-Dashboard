import {requireChatGPTUser} from '../chatgpt-auth';
import Inventory from './inventory';
export const dynamic='force-dynamic';
export default async function InventoryPage(){
  await requireChatGPTUser('/inventory');
  return <Inventory/>;
}
