import {dayKey,shiftDay,weekStart} from './calendar.mjs';
import {calendarDetails,calendarDescription,decodeIcsText,encodeIcsText} from './calendar-details.mjs';
import {inventoryDetails} from './inventory.mjs';
// Reduce a potentially large historical feed before parsing it. Preserve recurrence
// masters/exceptions and time zones, while discarding irrelevant past events.
export function calendarStream(now=new Date()) {
  const base=weekStart(dayKey(now));
  const floor=shiftDay(base,-30).replaceAll('-','');
  const ceiling=shiftDay(base,93).replaceAll('-','');
  const keep=new Set(['UID','SUMMARY','LOCATION','DTSTART','DTEND','DURATION','RECURRENCE-ID','RRULE','RDATE','EXDATE','STATUS','SEQUENCE','DTSTAMP']);
  let buffer='',logical='',event=null,zone=null,depth=0,valid=false,ended=false,kept=0,size=0;
  const output=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TERG Warehouse//EN'];
  const append=(lines)=>{const n=lines.join('\r\n').length;size+=n;if(size>12*1024*1024)throw new Error('Too many calendar details in the selected dates.');output.push(...lines);};
  function process(line) {
    line=line.replace(/^\uFEFF/,'');
    if(line==='BEGIN:VCALENDAR'){valid=true;return;}
    if(line==='END:VCALENDAR'){ended=true;return;}
    if(line==='BEGIN:VTIMEZONE'){zone=[line];return;}
    if(zone){zone.push(line);if(line==='END:VTIMEZONE'){append(zone);zone=null;}return;}
    if(line==='BEGIN:VEVENT'){event={lines:[line],start:'',end:'',recurrence:'',recurring:false,project:'',description:''};depth=1;return;}
    if(!event)return;
    if(line.startsWith('BEGIN:')){depth++;return;}
    if(line.startsWith('END:')){
      depth--;if(depth!==0)return;
      const candidate=event;event=null;
      const start=candidate.start.slice(0,8),end=candidate.end.slice(0,8)||start,rid=candidate.recurrence.slice(0,8);
      if(candidate.recurring || (start&&start<=ceiling&&end>=floor) || (rid&&rid>=floor&&rid<=ceiling)) {
        if(++kept>12000)throw new Error('Too many calendar events in the selected dates.');
        const description=decodeIcsText(candidate.description),details=calendarDetails(description),inventory=candidate.descriptionTooLong?{items:[],inventoryAvailable:false}:inventoryDetails(description);
        if(candidate.project)candidate.lines.push(`DESCRIPTION:https://pro.goodshuffle.com/app/project/detail?id=${candidate.project}`);
        candidate.lines.push(`X-WAREHOUSE-DESCRIPTION;VALUE=TEXT:${encodeIcsText(calendarDescription(description))}`);
        if(candidate.descriptionTooLong)candidate.lines.push('X-WAREHOUSE-DESCRIPTION-TRUNCATED;VALUE=TEXT:true');
        if(details.client)candidate.lines.push(`X-WAREHOUSE-CLIENT;VALUE=TEXT:${encodeIcsText(details.client)}`);
        if(details.venue)candidate.lines.push(`X-WAREHOUSE-VENUE;VALUE=TEXT:${encodeIcsText(details.venue)}`);
        candidate.lines.push(`X-WAREHOUSE-INVENTORY;VALUE=TEXT:${encodeIcsText(JSON.stringify(inventory))}`);
        append([...candidate.lines,'END:VEVENT']);
      }
      return;
    }
    if(depth!==1)return;
    const colon=line.indexOf(':');if(colon<0)return;
    const key=line.slice(0,colon).split(';')[0].toUpperCase(),value=line.slice(colon+1);
    if(key==='DTSTART')event.start=value;
    if(key==='DTEND')event.end=value;
    if(key==='RECURRENCE-ID')event.recurrence=value;
    if(key==='RRULE'||key==='RDATE')event.recurring=true;
    // DURATION may cross the beginning of the view even if DTSTART predates it.
    if(key==='DURATION')event.recurring=true;
    if(key==='DESCRIPTION'){
      event.project=value.match(/pro\.goodshuffle\.com\/[^\s<>"']*[?&](?:amp;)?id=(\d+)/)?.[1]||'';
      event.descriptionTooLong=value.length>250000;
      event.description=value.slice(0,250000);
    }
    if(keep.has(key))event.lines.push(line);
  }
  function physical(line){
    if(/^[ \t]/.test(line))logical+=line.slice(1);else{if(logical)process(logical);logical=line;}
    if(logical.length>2*1024*1024)throw new Error('A calendar detail is too large to read.');
  }
  return {
    write(chunk){buffer+=chunk;let newline;while((newline=buffer.indexOf('\n'))>=0){physical(buffer.slice(0,newline).replace(/\r$/,''));buffer=buffer.slice(newline+1);}if(buffer.length>2*1024*1024)throw new Error('A calendar line is too large to read.');},
    finish(){if(buffer)physical(buffer.replace(/\r$/,''));if(logical)process(logical);if(!valid||!ended||event||zone)throw new Error('Google returned an incomplete calendar feed.');return [...output,'END:VCALENDAR'].join('\r\n');}
  };
}
