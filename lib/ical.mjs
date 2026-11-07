import ICAL from 'ical.js';
import {TIME_ZONE,dayKey,shiftDay,weekStart,classify,isExact} from './calendar.mjs';
import {calendarDetails,calendarDescription} from './calendar-details.mjs';
import {inventoryDetails} from './inventory.mjs';
function timeDate(t) {
  if (t.isDate) return t.toString().slice(0,10);
  if (t.zone?.tzid === 'floating') {
    // Google normally supplies TZID or UTC. Interpret a floating event in the warehouse zone.
    const naive = Date.UTC(t.year,t.month-1,t.day,t.hour,t.minute,t.second);
    let millis = naive;
    for (let i=0;i<3;i++) {
      const parts = new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(millis));
      const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
      millis += naive - Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    }
    return new Date(millis).toISOString();
  }
  return t.toJSDate().toISOString();
}
export function parseCalendar(text, now = new Date()) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const c of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(c));
  const components = root.getAllSubcomponents('vevent');
  const overrides = new Map();
  for (const c of components) if (c.hasProperty('recurrence-id')) {
    const uid = c.getFirstPropertyValue('uid');
    overrides.set(uid,[...(overrides.get(uid)||[]),c]);
  }
  const base=weekStart(dayKey(now));
  const floor = new Date(`${shiftDay(base,-28)}T00:00:00Z`).getTime();
  // Include the final Sunday's evening in Eastern time at the navigation limit.
  const ceiling = new Date(`${shiftDay(base,92)}T00:00:00Z`).getTime();
  const result=[];
  function add(ev,start,end,occurrence='') {
    if (String(ev.component.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED') return;
    const a=timeDate(start), b=timeDate(end);
    if (new Date(b).getTime()<floor || new Date(a).getTime()>=ceiling) return;
    const title=String(ev.summary||'Untitled event');
    const description=String(ev.description||'');
    const fullDescription=String(ev.component.getFirstPropertyValue('x-warehouse-description')??calendarDescription(description));
    const descriptionTruncated=ev.component.getFirstPropertyValue('x-warehouse-description-truncated')==='true';
    const details=calendarDetails(description);
    const client=String(ev.component.getFirstPropertyValue('x-warehouse-client')||details.client);
    const venue=String(ev.component.getFirstPropertyValue('x-warehouse-venue')||details.venue);
    const inventoryField=ev.component.getFirstPropertyValue('x-warehouse-inventory');
    const inventory=inventoryField?JSON.parse(String(inventoryField)):inventoryDetails(description);
    const project=description.match(/pro\.goodshuffle\.com\/[^\s<>"']*[?&](?:amp;)?id=(\d+)/)?.[1] || null;
    result.push({id:`${ev.uid}:${occurrence||a}`,title,client,venue,description:fullDescription,descriptionTruncated,...inventory,location:String(ev.location||''),start:a,end:b,allDay:start.isDate,kind:classify(title),exact:isExact(title),project,fee:/\b(stair|elevator|rush)\s+fee\b/i.test(title.split('::')[0])});
  }
  for (const c of components) {
    if (c.hasProperty('recurrence-id') || !c.hasProperty('dtstart')) continue;
    const ev=new ICAL.Event(c,{exceptions:overrides.get(c.getFirstPropertyValue('uid'))||[]});
    if (ev.isRecurring()) {
      const iter=ev.iterator(); let t; let n=0;
      while ((t=iter.next()) && n++<50000) {
        if (new Date(timeDate(t)).getTime()>=ceiling) break;
        const occurrence=ev.getOccurrenceDetails(t);
        add(occurrence.item,occurrence.startDate,occurrence.endDate,t.toString());
        if(result.length>6000) throw new Error('Calendar contains too many events in this window.');
      }
      if(n>=50000) throw new Error('A recurring event is too large to read safely.');
    } else add(ev,ev.startDate,ev.endDate);
  }
  return result.sort((a,b)=>a.start.localeCompare(b.start));
}
