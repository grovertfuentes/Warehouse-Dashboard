import { REFRESH_INTERVAL_MS } from './calendar.mjs';
const connectionErrors={
  storage_read:{status:503,message:'The saved calendar settings could not be read. Please try again shortly.'},
  feed_read:{status:502,message:'Google Calendar could not be read. Check that the private feed link is current, then try again.'},
  storage_write:{status:503,message:'The calendar was read, but its settings could not be saved. Your existing connection is unchanged. Please try again shortly.'},
  storage_conflict:{status:409,message:'The calendar was updated while this connection was being saved. Please try again.'}
};
export class CalendarConnectionError extends Error {
  constructor(code){super(connectionErrors[code].message);this.code=code;this.status=connectionErrors[code].status;}
}
export function createCalendarService({readState,writeState,readFeed,now=Date.now}) {
  return {
    async read(force=false) {
      const {state,etag}=await readState();
      if(!state)return {connected:false,events:[],fetchedAt:null};
      const fresh=state.events.every(event=>'description' in event&&'inventoryAvailable' in event);
      if(fresh&&now()-state.fetchedAt<(force?30000:REFRESH_INTERVAL_MS))return {connected:true,events:state.events,fetchedAt:state.fetchedAt,stale:false};
      try {
        const events=await readFeed(state.feedUrl),fetchedAt=now();
        await writeState({...state,events,fetchedAt},etag);
        return {connected:true,events,fetchedAt,stale:false};
      } catch {
        return {connected:true,events:state.events,fetchedAt:state.fetchedAt,stale:true,error:'The calendar could not be refreshed. Showing the last saved schedule. Please retry.'};
      }
    },
    async connect(feedUrl) {
      let stored,events;
      try {stored=await readState();} catch {throw new CalendarConnectionError('storage_read');}
      try {events=await readFeed(feedUrl);} catch {throw new CalendarConnectionError('feed_read');}
      const timestamp=now();
      // Replace connection and its first validated schedule atomically.
      try {await writeState({feedUrl,events,fetchedAt:timestamp,updatedAt:timestamp},stored.etag);}
      catch(error){throw new CalendarConnectionError(error?.constructor?.name==='BlobPreconditionFailedError'?'storage_conflict':'storage_write');}
      return {success:true};
    }
  };
}
