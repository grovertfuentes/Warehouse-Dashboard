import { validFeedUrl } from './calendar.mjs';
import { parseCalendar } from './ical.mjs';
import { calendarStream } from './ics-stream.mjs';
export async function readFeed(url: string) {
  if (!validFeedUrl(url)) throw new Error('Use the Secret address in iCal format for Contract Signed - GSPro.');
  let response: Response;
  // Workers supports manual/follow only. Reject redirects via response.ok below.
  try { response = await fetch(url, {cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(60000),headers:{Accept:'text/calendar'}}); }
  catch { throw new Error('Google Calendar could not be reached. Please try again.'); }
  if (!response.ok) throw new Error('Google could not provide this calendar. Check that the private feed link is current.');
  if (!response.body) throw new Error('Google returned an empty response.');
  const reader=response.body.getReader();const decoder=new TextDecoder();const calendar=calendarStream();let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128*1024*1024){await reader.cancel();throw new Error('This calendar feed is too large.');}calendar.write(decoder.decode(value,{stream:true}));}
    calendar.write(decoder.decode());
  } finally {reader.releaseLock();}
  try { return parseCalendar(calendar.finish()); } catch { throw new Error('The calendar could not be read completely. Please check the feed and try again.'); }
}
