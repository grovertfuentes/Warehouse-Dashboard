import { hasWarehouseAccess } from '../../../lib/warehouse-access';
import { warehouseOriginAllowed } from '../../../lib/warehouse-access.mjs';
import { warehouseCalendar } from '../../../lib/warehouse-calendar';
import { validFeedUrl } from '../../../lib/calendar.mjs';
export const runtime='nodejs';
export const maxDuration=120;
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request) {
  if(!await hasWarehouseAccess())return send({error:'Open the protected Vercel dashboard before connecting the calendar.'},403);
  if(!warehouseOriginAllowed({origin:request.headers.get('origin'),host:request.headers.get('host'),nodeEnv:process.env.NODE_ENV}))return send({error:'Please connect from this dashboard.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return send({error:'Invalid request.'},415);
  try {
    const body=await request.text();if(body.length>3000)return send({error:'The calendar address is too long.'},400);
    const {url}=JSON.parse(body);
    if(typeof url!=='string'||!validFeedUrl(url.trim()))return send({error:'Use the Secret address in iCal format for Contract Signed - GSPro.'},400);
    return send(await warehouseCalendar.connect(url.trim()));
  } catch{return send({error:'The calendar could not be connected. Check the private feed link and try again.'},400);}
}
