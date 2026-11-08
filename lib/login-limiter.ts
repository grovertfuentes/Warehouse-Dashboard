import 'server-only';
import {get,put} from '@vercel/blob';
import {loginAttemptDecision,loginClientKey} from './warehouse-session.mjs';

type Attempt={key:string;time:number};
let localAttempts:Attempt[]=[];
export async function reserveLoginAttempt(ip:string,secret:string){
  const key=loginClientKey(ip,secret);
  if(process.env.NODE_ENV==='development'&&process.env.VERCEL!=='1'){
    const result=loginAttemptDecision(localAttempts,key);localAttempts=result.attempts;return result;
  }
  const path=`warehouse/${process.env.VERCEL_ENV==='production'?'production':'preview'}/login-attempts.json`;
  for(let attempt=0;attempt<5;attempt++){
    const blob=await get(path,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
    if(blob&&blob.statusCode!==200)throw new Error('Sign-in storage is unavailable.');
    const saved:Attempt[]=blob?await new Response(blob.stream).json():[];
    if(!Array.isArray(saved))throw new Error('Sign-in storage is unavailable.');
    const result=loginAttemptDecision(saved,key);
    if(!result.allowed)return result;
    try{
      await put(path,JSON.stringify(result.attempts),{access:'private',addRandomSuffix:false,allowOverwrite:!!blob,contentType:'application/json',cacheControlMaxAge:60,...(blob?{ifMatch:blob.blob.etag}:{})});
      return result;
    }catch{
      // Retry with fresh state if another login reserved a slot first.
      if(attempt===4)throw new Error('Sign-in storage is unavailable.');
    }
  }
  throw new Error('Sign-in storage is unavailable.');
}
