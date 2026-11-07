import { eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { calendarConnections, calendarCache } from '../../../db/schema';
import { readFeed } from '../../../lib/feed';
import { REFRESH_INTERVAL_MS } from '../../../lib/calendar.mjs';
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request) {
  const user=await getChatGPTUser();if(!user)return send({error:'Sign in to view your warehouse calendar.'},401);
  try {
    const db=getDb();
    const connection=await db.select().from(calendarConnections).where(eq(calendarConnections.userId,user.userId)).get();
    if(!connection)return send({connected:false,events:[],fetchedAt:null});
    const cached=await db.select().from(calendarCache).where(eq(calendarCache.userId,user.userId)).get();
    const cachedEvents=cached?JSON.parse(cached.events):[];
    const hasClientDetails=cachedEvents.every((event:Record<string,unknown>)=>'client' in event&&'venue' in event&&'inventoryAvailable' in event&&'description' in event);
    const refresh=new URL(request.url).searchParams.get('refresh')==='1';
    if(cached&&hasClientDetails&&Date.now()-cached.fetchedAt<(refresh?30000:REFRESH_INTERVAL_MS)) return send({connected:true,events:cachedEvents,fetchedAt:cached.fetchedAt,stale:false});
    try {
      const events=await readFeed(connection.feedUrl); const fetchedAt=Date.now();
      await db.insert(calendarCache).values({userId:user.userId,events:JSON.stringify(events),fetchedAt}).onConflictDoUpdate({target:calendarCache.userId,set:{events:JSON.stringify(events),fetchedAt}});
      return send({connected:true,events,fetchedAt,stale:false});
    } catch(error) {
      return send({connected:true,events:cached?JSON.parse(cached.events):[],fetchedAt:cached?.fetchedAt??null,stale:true,error:error instanceof Error?error.message:'Calendar refresh failed.'},cached?200:502);
    }
  } catch {return send({error:'Calendar storage is temporarily unavailable. Please try again.'},503);}
}
