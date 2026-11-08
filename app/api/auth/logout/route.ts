import {clearWarehouseSession} from '../../../../lib/warehouse-access';
import {warehouseOriginAllowed} from '../../../../lib/warehouse-access.mjs';
export const runtime='nodejs';
export async function POST(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  if(!warehouseOriginAllowed({origin:request.headers.get('origin'),host:request.headers.get('host'),nodeEnv:process.env.NODE_ENV}))return Response.json({error:'Invalid request.'},{status:403,headers});
  await clearWarehouseSession();
  return Response.json({success:true},{headers});
}
