import { getWarehouseSession,saveWarehouseSession } from '../../../lib/warehouse-access';
import { warehouseCalendar } from '../../../lib/warehouse-calendar';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request) {
  const session=await getWarehouseSession();
  if(!session)return send({error:'Please sign in to view this calendar.'},401);
  await saveWarehouseSession(session.remember);
  try{return send(await warehouseCalendar.read(new URL(request.url).searchParams.get('refresh')==='1'));}
  catch{return send({error:'Calendar storage is temporarily unavailable. Please try again.'},503);}
}
