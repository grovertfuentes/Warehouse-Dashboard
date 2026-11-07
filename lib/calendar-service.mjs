import { REFRESH_INTERVAL_MS } from './calendar.mjs';
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
      const {etag}=await readState();
      const events=await readFeed(feedUrl),timestamp=now();
      // Replace connection and its first validated schedule atomically.
      await writeState({feedUrl,events,fetchedAt:timestamp,updatedAt:timestamp},etag);
      return {success:true};
    }
  };
}
