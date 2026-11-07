import 'server-only';
import { get, put } from '@vercel/blob';
import type { readFeed } from './feed';

export type CalendarState={feedUrl:string;events:Awaited<ReturnType<typeof readFeed>>;fetchedAt:number;updatedAt:number};
export type StoredCalendar={state:CalendarState|null;etag?:string};
const local=process.env.NODE_ENV==='development'&&process.env.VERCEL!=='1';
const storagePath=`warehouse/${process.env.VERCEL_ENV==='production'?'production':'preview'}/calendar-state.json`;

export async function readCalendarState():Promise<StoredCalendar> {
  if(local){
    const {readFile}=await import('node:fs/promises');
    try{return {state:JSON.parse(await readFile('.warehouse-local/calendar-state.json','utf8'))};}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {state:null};throw error;}
  }
  const blob=await get(storagePath,{access:'private',useCache:false});
  if(!blob)return {state:null};
  if(blob.statusCode!==200)throw new Error('Calendar storage could not be read.');
  const state=await new Response(blob.stream).json() as CalendarState;
  if(typeof state.feedUrl!=='string'||!Array.isArray(state.events)||!Number.isFinite(state.fetchedAt))throw new Error('Calendar storage is incomplete.');
  return {state,etag:blob.blob.etag};
}
export async function writeCalendarState(state:CalendarState,etag?:string) {
  if(local){
    const {mkdir,writeFile,rename}=await import('node:fs/promises');
    const {randomUUID}=await import('node:crypto');
    await mkdir('.warehouse-local',{recursive:true});
    const temp=`.warehouse-local/${randomUUID()}.tmp`;
    await writeFile(temp,JSON.stringify(state),{mode:0o600});
    await rename(temp,'.warehouse-local/calendar-state.json');return;
  }
  await put(storagePath,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:60,...(etag?{ifMatch:etag}:{})});
}
