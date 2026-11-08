import 'server-only';
import { cookies } from 'next/headers';
import {authConfigured,createWarehouseSession,readWarehouseSession,SESSION_SECONDS} from './warehouse-session.mjs';
export function warehouseAuthConfig(){return {secret:process.env.WAREHOUSE_SESSION_SECRET||'',passwordHash:process.env.WAREHOUSE_PASSWORD_HASH||'',scope:process.env.VERCEL_ENV||'development'};}
const secure=process.env.NODE_ENV!=='development';
export const warehouseCookieName=secure?'__Host-terg_session':'terg_session';
export async function getWarehouseSession(){
  return readWarehouseSession((await cookies()).get(warehouseCookieName)?.value,warehouseAuthConfig());
}
export async function hasWarehouseAccess() {
  return !!await getWarehouseSession();
}
export async function saveWarehouseSession(remember:boolean){
  const config=warehouseAuthConfig();
  if(!authConfigured(config))throw new Error('Warehouse sign-in is not configured.');
  const token=await createWarehouseSession(remember,config);
  (await cookies()).set(warehouseCookieName,token,{httpOnly:true,secure,sameSite:'strict',path:'/',...(remember?{maxAge:SESSION_SECONDS}:{})});
}
export async function clearWarehouseSession(){(await cookies()).set(warehouseCookieName,'',{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:0});}
