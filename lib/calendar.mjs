export const TIME_ZONE = 'America/New_York';
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
export const STALE_AFTER_MS = REFRESH_INTERVAL_MS + 15 * 60 * 1000;
export const CALENDAR_ID = 'c_c9lbmd56gro8k1j4vhfhv9hl3g@group.calendar.google.com';
/** @param {Date|string|number} value */
export function dayKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function shiftDay(day, delta) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0,10); }
// Use a calendar date in the warehouse time zone; Sunday belongs to the prior Monday.
export function weekStart(day) { const weekday=new Date(`${day}T12:00:00Z`).getUTCDay(); return shiftDay(day,-((weekday+6)%7)); }
export function classify(title) {
  const service=title.split('::')[0];
  if (/\b(?:carry[ -]?out|will[\s-]?call|customer\s+(?:pick[\s-]?up|return)|order prep)\b/i.test(service)) return 'carryout';
  if (/pick[\s-]?up/i.test(title)) return 'pickup';
  if (/drop[\s-]?off|deliver/i.test(title)) return 'delivery';
  return 'other';
}
// Will calls are outgoing customer pickups at the warehouse, not customer returns.
export function isWillCall(job) {return job.kind==='carryout'&&!/\breturns?\b/i.test(job.title.split('::')[0]);}
export function isExact(title) { return /exact[\s-]+time/i.test(title); }
export function isPriorityJob(job) {return ['delivery','pickup'].includes(job.kind)&&(job.exact||/\b(?:exact[\s-]+(?:day|time)|short[\s-]+window)\b/i.test(job.title.split('::')[0]));}
export function validFeedUrl(value) {
  try {
    const u = new URL(value);
    const parts = u.pathname.split('/');
    return u.protocol === 'https:' && u.hostname === 'calendar.google.com' && !u.port && !u.username && !u.password && !u.search && !u.hash &&
      parts.length === 6 && parts[1] === 'calendar' && parts[2] === 'ical' && decodeURIComponent(parts[3]) === CALENDAR_ID && /^private-[a-zA-Z0-9]+$/.test(parts[4]) && parts[5] === 'basic.ics';
  } catch { return false; }
}
export function appearsOn(event,day) {
  const first=event.allDay?event.start.slice(0,10):dayKey(event.start);
  return day===first;
}
export function deliveryWindowEnd(job) {
  if(job.kind!=='delivery')return '';
  const first=job.allDay?job.start.slice(0,10):dayKey(job.start);
  const last=job.allDay?shiftDay(job.end.slice(0,10),-1):dayKey(Math.max(Date.parse(job.start),Date.parse(job.end)-1));
  return last>first?last:'';
}
export function serviceLabel(job) {
  const fallback={delivery:'Delivery',pickup:'Pickup',carryout:'Carry-out',other:'Event'}[job.kind]||'Event';
  const title=job.title.split('::')[0].trim();
  let label=title.replace(/\(\s*(?:drop[ -]?off|pick[ -]?up|carry[ -]?out)\s*\)/gi,'').replace(/\s*[-–—]\s*(?:drop[ -]?off|pick[ -]?up)\s*$/i,'').replace(/\s*[-–—]\s*$/,'').trim();
  if(job.kind==='pickup')label=label.replace(/\bdelivery\b/gi,'Pickup');
  if(job.kind==='carryout')label=isWillCall(job)?'Will call':'Customer return';
  return label||fallback;
}
// Fit each day using its actual card heights, keeping order and every job.
export function packByHeight(items, heights, available, gap=5) {
  if(!items.length)return [];
  const limit=available>0?available:300,pages=[];
  let page=[],used=0;
  for(let i=0;i<items.length;i++){
    const height=Number.isFinite(heights[i])&&heights[i]>0?heights[i]:72;
    const needed=height+(page.length?gap:0);
    if(page.length&&used+needed>limit){pages.push(page);page=[];used=0;}
    used+=height+(page.length?gap:0);page.push(items[i]);
  }
  if(page.length)pages.push(page);
  return pages;
}
// Goodshuffle summaries use "service :: client - venue/project". Keep only
// recognizable venue names; an address or an event title is not a venue name.
export function jobNames(job) {
  const body=job.title.includes('::')?job.title.split('::').slice(1).join('::').trim():'';
  const parts=body.split(/\s+[-–—]\s+/);
  const clean=value=>String(value||'').replace(/\s*[\[(](?=[^\])]*(?:\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|20\d{2})\b))[^\])]*[\])]/gi,'').trim();
  const client=String(job.client||'').trim()||clean(parts[0])||'Client not listed';
  const venueWords=/\b(hilton|marriott|hyatt|sheraton|westin|hotel|club|church|chapel|temple|synagogue|hall|ballroom|manor|estate|castle|museum|gallery|school|university|college|center|centre|restaurant|tavern|inn|resort|park|gardens?|farm|winery|vineyard|brewery|lofts?|apartments?|pavilion|theat(?:er|re)|arena|stadium|lodge)\b/i;
  const isAddress=value=>/^\d+[\w-]*\s/.test(value)||/\bP\.?\s?O\.?\s+Box\b/i.test(value);
  const location=clean(String(job.location||'').split(/[,\n]/)[0]);
  const tail=clean(parts.slice(1).join(' - '));
  const namedLocation=location&&!isAddress(location)&&!/^\s*(?:tbd|n\/?a|unknown|location not provided)\s*$/i.test(location)?location:'';
  const declaredVenue=clean(job.venue);
  const venue=(declaredVenue&&!isAddress(declaredVenue)?declaredVenue:'')||namedLocation||(tail&&!isAddress(tail)&&venueWords.test(tail)?tail:'');
  return {client,venue};
}
function stopKey(e) {
  const name=e.title.split('::').slice(1).join('::').trim().toLowerCase();
  // Match a fee to its corresponding movement; never combine separate time windows.
  return `${e.kind}|${e.project||name||e.id}|${e.location.trim().toLowerCase()}|${e.start}|${e.end}`;
}
export function eventsOnDay(events,day) {
  const active=events.filter(e=>appearsOn(e,day));
  const stops = active.filter(e=>!e.fee).map(e=>({...e,notes:[]}));
  for (const fee of active.filter(e=>e.fee)) {
    const match=stops.find(e=>stopKey(e)===stopKey(fee));
    if(match) {match.notes.push(fee.title.split('::')[0].trim());match.exact ||= fee.exact;}
    else stops.push({...fee,kind:'other',notes:['Service fee — not counted as a separate stop']});
  }
  return stops.sort((a,b)=>Number(isPriorityJob(b))-Number(isPriorityJob(a))||a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
export function totals(events) { return {delivery:events.filter(e=>e.kind==='delivery').length,pickup:events.filter(e=>e.kind==='pickup').length,carryout:events.filter(e=>e.kind==='carryout').length,willCall:events.filter(isWillCall).length}; }
