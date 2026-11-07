import {decodeHTML} from 'entities';
import {dayKey, shiftDay, jobNames} from './calendar.mjs';

// Keep only the equipment lines in Goodshuffle's named, top-level item sections.
// Financial charges and service sections are not physical equipment to pull.
export function inventoryDetails(description) {
  const raw=String(description||'');
  if(raw.length>250000)return {items:[],inventoryAvailable:false};
  const text=decodeHTML(raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' '))
    .replace(/\*\*/g,'').replace(/\\(?=-)/g,'').replace(/\s+/g,' ').replace(/Top-\s+level/gi,'Top-level').trim();
  const sections=text.split(/-{3,}\s*(.*?)\s*-{3,}/g),items=[];
  let found=false,valid=true;
  for(let i=1;i<sections.length;i+=2){
    const heading=sections[i],body=sections[i+1]||'';
    if(!/\(Top-level only\)/i.test(heading)||/\b(labor|labour|logistics|setup|set-up|breakdown|teardown|services?)\b/i.test(heading))continue;
    found=true;
    const matches=[...body.matchAll(/\bItem:\s*(.*?)\s*\(Qty:\s*([\d,.]+)\s*\)/gi)];
    if(matches.length!==(body.match(/\bItem:/gi)||[]).length)valid=false;
    for(const match of matches){
      const name=match[1].trim(),quantity=Number(match[2].replaceAll(',',''));
      if(/\brental protection\b|\bRPP\b|\bfee\b|\bminimum requirement\b|\bdiscount\b|\bdeposit\b|\bsetup and (?:strike|teardown)\b/i.test(name))continue;
      if(!name||name.length>500||!Number.isFinite(quantity)||quantity<=0){valid=false;continue;}
      items.push({name,quantity});
    }
  }
  return {items,inventoryAvailable:found&&valid};
}

// Calendar entries repeat the whole project list on each delivery and pickup.
// Count one list per project on its first outgoing date, excluding returns/fees.
export function inventoryForWeek(events,start) {
  const end=shiftDay(start,6),projects=new Map();
  const outgoing=events.filter(job=>!job.fee&&(job.kind==='delivery'||(job.kind==='carryout'&&!/\breturn\b/i.test(job.title.split('::')[0]))))
    .slice().sort((a,b)=>a.start.localeCompare(b.start));
  for(const job of outgoing){
    const key=job.project||job.id;
    if(!projects.has(key))projects.set(key,job);
  }
  const rows=new Map(),missing=[];let projectCount=0;
  for(const job of projects.values()){
    const day=job.allDay?job.start.slice(0,10):dayKey(job.start);
    if(day<start||day>end)continue;
    projectCount++;
    const client=jobNames(job).client;
    if(!job.inventoryAvailable)missing.push({id:job.id,client,day});
    for(const item of job.items||[]){
      const key=item.name.toLocaleLowerCase().replace(/\s+/g,' ').trim();
      const row=rows.get(key)||{name:item.name,quantity:0,neededBy:day,allocations:[]};
      row.quantity+=item.quantity;
      row.neededBy=row.neededBy<day?row.neededBy:day;
      const allocation=row.allocations.find(a=>a.id===(job.project||job.id));
      if(allocation)allocation.quantity+=item.quantity;
      else row.allocations.push({id:job.project||job.id,client,day,quantity:item.quantity});
      rows.set(key,row);
    }
  }
  return {rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name)),projectCount,missing};
}
