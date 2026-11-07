'use client';
import { ArrowDownLeft, ArrowUpRight, Clock3, MapPin, PackageOpen, X } from 'lucide-react';
import { dayKey, shiftDay, jobNames, serviceLabel, isPriorityJob, TIME_ZONE } from '../lib/calendar.mjs';

export type Job={id:string;title:string;client?:string;venue?:string;location:string;description?:string;descriptionTruncated?:boolean;start:string;end:string;allDay:boolean;kind:string;exact:boolean;project?:string;fee?:boolean;notes?:string[]};

function scheduleLabel(job:Job){
  const date=(day:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
  if(job.allDay){const start=job.start.slice(0,10),end=shiftDay(job.end.slice(0,10),-1);return `${date(start)}${end>start?` → ${date(end)}`:''} · All day`;}
  const time=(value:string)=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:TIME_ZONE}).format(new Date(value));
  const start=`${date(dayKey(job.start))}, ${time(job.start)}`;
  return job.start===job.end?start:`${start} → ${date(dayKey(job.end))}, ${time(job.end)}`;
}

function Description({text}:{text:string}){
  // Only plain text and explicit HTTP(S) links are rendered from calendar content.
  return <div className="calendar-description">{text.split(/(https?:\/\/[^\s<>"'()]+)/gi).map((part,index)=>/^https?:\/\//i.test(part)?<a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>:part)}</div>;
}

export default function JobDetails({job,onClose}:{job:Job;onClose:()=>void}){
  const names=jobNames(job),priority=isPriorityJob(job),service=serviceLabel(job),address=job.location.trim();
  const mapUrl=`https://maps.google.com/maps?hl=en&q=${encodeURIComponent(address)}&z=14&output=embed`;
  const mapLink=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return <>
    <div className="detail-header"><div><span className={`detail-kind ${job.kind} ${priority?'priority-label':''}`}>{job.kind==='delivery'?<ArrowUpRight size={16}/>:job.kind==='pickup'?<ArrowDownLeft size={16}/>:<PackageOpen size={16}/>} {service}</span><h2 id="event-details-title">{names.client}</h2>{names.venue&&<p className="detail-venue">{names.venue}</p>}</div><button className="detail-close" aria-label="Close event details" onClick={onClose} autoFocus><X size={22}/></button></div>
    <div className="detail-body">
      {priority&&<div className="detail-exact"><Clock3 size={16}/>{job.exact?'EXACT TIME — scheduled time matters':/short[ -]+window/i.test(service)?'SHORT WINDOW — stay within the scheduled window':'EXACT DAY — scheduled day matters'}</div>}
      <div className="detail-overview">
        <dl className="detail-facts"><dt>Scheduled window</dt><dd>{scheduleLabel(job)}<small>Eastern time</small></dd><dt><MapPin size={13}/> Address</dt><dd>{address||'No address provided in the calendar event.'}{address&&<a className="map-open-link" href={mapLink} target="_blank" rel="noopener noreferrer">Open in Google Maps <ArrowUpRight size={14}/></a>}</dd>{job.notes?.length?<><dt>Service notes</dt><dd>{job.notes.join(' · ')}</dd></>:null}</dl>
        {address?<div className="event-map"><iframe key={job.id+address} title={`Google Map for ${address}`} src={mapUrl} loading="eager" referrerPolicy="no-referrer" allowFullScreen/><span>Event location · Google Maps</span></div>:<div className="event-map-empty"><MapPin size={28}/><span>A map will appear when the calendar event includes an address.</span></div>}
      </div>
      <section className="event-description" aria-labelledby="calendar-description-title"><div className="eyebrow" id="calendar-description-title">GOOGLE CALENDAR EVENT</div><h3>{job.title}</h3>{job.description?<Description text={job.description}/>:<p>{job.description===undefined?'Event details are still loading. Refresh the calendar and reopen this job.':'No description provided in this calendar event.'}</p>}{job.descriptionTruncated&&<p className="description-notice">This unusually long description is incomplete. See the full event in Google Calendar.</p>}</section>
    </div>
    <div className="detail-footer"><span>Contract Signed - GSPro</span><button className="connect-submit" onClick={onClose}>Done</button></div>
  </>;
}
