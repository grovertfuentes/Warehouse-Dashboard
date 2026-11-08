import {authConfigured,passwordMatches} from '../../../../lib/warehouse-session.mjs';
import {warehouseAuthConfig,saveWarehouseSession} from '../../../../lib/warehouse-access';
import {warehouseOriginAllowed} from '../../../../lib/warehouse-access.mjs';
import {reserveLoginAttempt} from '../../../../lib/login-limiter';
export const runtime='nodejs';
export const maxDuration=30;
const send=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...extra}});
export async function POST(request:Request){
  if(!warehouseOriginAllowed({origin:request.headers.get('origin'),host:request.headers.get('host'),nodeEnv:process.env.NODE_ENV}))return send({error:'Please sign in from this dashboard.'},403);
  const config=warehouseAuthConfig();
  if(!authConfigured(config))return send({error:'Sign-in is temporarily unavailable.'},503);
  if(!request.headers.get('content-type')?.includes('application/json'))return send({error:'Invalid sign-in request.'},400);
  let password:unknown,remember:unknown;
  try{const body=await request.text();if(body.length>1024)return send({error:'Invalid sign-in request.'},400);({password,remember}=JSON.parse(body));}catch{return send({error:'Invalid sign-in request.'},400);}
  if(typeof password!=='string'||!password||password.length>128)return send({error:'Enter the warehouse password.'},400);
  try{
    // Vercel overwrites this header with the connecting client address.
    const ip=process.env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()||'unknown'):'local';
    const limit=await reserveLoginAttempt(ip,config.secret);
    if(!limit.allowed)return send({error:'Too many sign-in attempts. Please try again later.'},429,{'Retry-After':String(limit.retryAfter)});
    if(!await passwordMatches(password,config))return send({error:'That password is incorrect. Please try again.'},401);
    await saveWarehouseSession(remember===true);
    return send({success:true});
  }catch{return send({error:'Sign-in is temporarily unavailable. Please try again shortly.'},503);}
}
