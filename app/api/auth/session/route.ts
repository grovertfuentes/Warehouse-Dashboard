import {getWarehouseSession,saveWarehouseSession} from '../../../../lib/warehouse-access';
import {warehouseOriginAllowed} from '../../../../lib/warehouse-access.mjs';
export const runtime='nodejs';
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
  if(!warehouseOriginAllowed({origin:request.headers.get('origin'),host:request.headers.get('host'),nodeEnv:process.env.NODE_ENV}))return send({error:'Invalid request.'},403);
  const session=await getWarehouseSession();
  if(!session)return send({error:'Please sign in.'},401);
  await saveWarehouseSession(session.remember);
  return send({authenticated:true});
}
