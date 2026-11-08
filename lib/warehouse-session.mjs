import { createHash, createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { sealData, unsealData } from 'iron-session';

const scrypt=promisify(scryptCallback);
export const SESSION_SECONDS=30*24*60*60;
export function authConfigured(config){return typeof config.secret==='string'&&config.secret.length>=32&&/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(config.passwordHash||'');}
function version(config){return createHash('sha256').update(config.passwordHash).digest('hex');}
export async function passwordMatches(password,config){
  if(!authConfigured(config)||typeof password!=='string'||password.length>128)return false;
  const [salt,expected]=config.passwordHash.split(':');
  const actual=await scrypt(password,salt,64);
  return timingSafeEqual(Buffer.from(expected,'hex'),actual);
}
export async function createWarehouseSession(remember,config,now=Date.now()){
  if(!authConfigured(config))throw new Error('Warehouse sign-in is not configured.');
  return sealData({authenticated:true,version:version(config),scope:config.scope,remember:remember===true,expiresAt:now+SESSION_SECONDS*1000},{password:config.secret,ttl:SESSION_SECONDS});
}
export async function readWarehouseSession(token,config,now=Date.now()){
  if(!authConfigured(config)||typeof token!=='string'||token.length>4096)return null;
  try{
    const session=await unsealData(token,{password:config.secret,ttl:SESSION_SECONDS});
    if(!session||session.authenticated!==true||session.version!==version(config)||session.scope!==config.scope||typeof session.remember!=='boolean'||!Number.isFinite(session.expiresAt)||session.expiresAt<=now||session.expiresAt>now+SESSION_SECONDS*1000+60000)return null;
    return session;
  }catch{return null;}
}
export function loginClientKey(ip,secret){return createHmac('sha256',secret).update(ip||'unknown').digest('hex');}

// Shared counters are reserved BEFORE checking the password, so concurrent
// requests cannot bypass the limit. IP addresses themselves are never stored.
export function loginAttemptDecision(attempts,key,now=Date.now()){
  const recent=attempts.filter(a=>Number.isFinite(a.time)&&a.time>now-3600000);
  const client=recent.filter(a=>a.key===key&&a.time>now-15*60000);
  const retryAt=Math.max(recent.length>=20?Math.min(...recent.map(a=>a.time))+3600000:0,client.length>=5?Math.min(...client.map(a=>a.time))+15*60000:0);
  return retryAt>now?{allowed:false,retryAfter:Math.ceil((retryAt-now)/1000),attempts:recent}:{allowed:true,retryAfter:0,attempts:[...recent,{key,time:now}]};
}
