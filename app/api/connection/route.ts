import { eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { calendarConnections, calendarCache } from '../../../db/schema';
import { readFeed } from '../../../lib/feed';
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request) {
  const user=await getChatGPTUser();if(!user)return send({error:'Sign in before connecting the calendar.'},401);
  if(request.headers.get('origin')!==new URL(request.url).origin)return send({error:'Please connect from this dashboard.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return send({error:'Invalid request.'},415);
  try {
    const body=await request.text();if(body.length>3000)return send({error:'The calendar address is too long.'},400);
    const {url}=JSON.parse(body);if(typeof url!=='string')return send({error:'Enter the private calendar feed address.'},400);
    const events=await readFeed(url.trim());const now=Date.now();const db=getDb();
    await db.batch([
      db.insert(calendarConnections).values({userId:user.userId,feedUrl:url.trim(),updatedAt:now}).onConflictDoUpdate({target:calendarConnections.userId,set:{feedUrl:url.trim(),updatedAt:now}}),
      db.insert(calendarCache).values({userId:user.userId,events:JSON.stringify(events),fetchedAt:now}).onConflictDoUpdate({target:calendarCache.userId,set:{events:JSON.stringify(events),fetchedAt:now}}),
    ]);
    return send({success:true});
  } catch(error) {return send({error:error instanceof Error && !/SQL|D1|database|query/i.test(error.message)?error.message:'The connection could not be saved. Please try again.'},400);}
}
