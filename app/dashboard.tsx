'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Box, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock3, Expand, PackageOpen, RefreshCw, Settings2, X, AlertTriangle, Link2, Pause, Play } from 'lucide-react';
import Brand from './brand';
import {SignOutButton} from './session-controls';
import JobDetails, { type Job } from './job-details';
import { dayKey, shiftDay, weekStart, eventsOnDay, totals, jobNames, serviceLabel, deliveryWindowEnd, packByHeight, isPriorityJob, TIME_ZONE, REFRESH_INTERVAL_MS, STALE_AFTER_MS } from '../lib/calendar.mjs';

type Feed={connected:boolean;events:Job[];fetchedAt:number|null;stale?:boolean;error?:string};
const dateFmt=(day:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
const timeFmt=(date:string)=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:TIME_ZONE}).format(new Date(date)).replace(':00','');
function timeLabel(job:Job){
  if(job.allDay)return 'All day';
  const first=dayKey(job.start),last=dayKey(new Date(Math.max(Date.parse(job.start),Date.parse(job.end)-1)));
  if(first!==last)return `From ${timeFmt(job.start)}`;
  if(job.start===job.end || job.exact)return timeFmt(job.start);
  return `${timeFmt(job.start)}–${timeFmt(job.end)}`;
}
function TypeIcon({kind,size=14}:{kind:string;size?:number}){return kind==='delivery'?<ArrowUpRight size={size}/>:kind==='pickup'?<ArrowDownLeft size={size}/>:<PackageOpen size={size}/>;}
function demoJobs(start:string):Job[]{
  const names=['Alex Garcia - Garden Club','Jamie Jones - Grand Hotel','Priya Patel - Park Pavilion','Morgan Smith','Jordan Lee - Lakeside Manor','Taylor Wilson - Town Hall','Casey Davis'];
  return Array.from({length:21},(_,i)=>names[i%7]).flatMap((name,i)=>Array.from({length:[2,3,1,9,4,3,1][i%7]},(_,j)=>{
    const day=shiftDay(start,i),kind=i%7===4&&j===0?'carryout':j%2?'pickup':'delivery',exact=(i===1&&j===0)||(i===4&&j===2);
    const service=exact?'Exact Time':j%3===2?'Short Window':i%3===0?'Exact Day':'Standard',endDay=i%7===6?shiftDay(day,1):day;
    return {id:`sample-${i}-${j}`,title:`${kind==='carryout'?'Order Prep Fee - (Carry-Out)':`${service} Delivery - (${kind==='pickup'?'Pickup':'Drop-Off'})`} :: ${name}${j?' '+(j+1):''}`,client:name.split(' - ')[0],venue:name.split(' - ')[1]||'',location:'1 Hilton Ct, Parsippany-Troy Hills, NJ 07054',description:'Sample calendar event — for layout preview only.\n\nContract Notes: Check in with the venue contact at the loading entrance. Call the client before arrival.\n\nRental Items\nItem: Folding Chair (Qty: 50)\nItem: Banquet Table (Qty: 6)',start:`${day}T${String(7+j).padStart(2,'0')}:00:00-05:00`,end:`${endDay}T${String(8+j).padStart(2,'0')}:00:00-05:00`,allDay:false,kind,exact};
  }));
}
function JobCard({job,onSelect,measure=false}:{job:Job;onSelect?:(job:Job)=>void;measure?:boolean}){
  const names=jobNames(job),service=serviceLabel(job),last=deliveryWindowEnd(job);
  const first=job.allDay?job.start.slice(0,10):dayKey(job.start);
  const marker=last?`${last===shiftDay(first,1)?'May deliver':'Window to'} ${dateFmt(last,{weekday:'short'})}`:'';
  const windowHelp=last?`Delivery window: ${dateFmt(first,{weekday:'long',month:'short',day:'numeric'})} through ${dateFmt(last,{weekday:'long',month:'short',day:'numeric'})}. Shown and counted only on the first day.`:'';
  return <button className={`job-card ${job.kind} ${isPriorityJob(job)?'priority-job':''}`} tabIndex={measure?-1:undefined} onClick={measure?undefined:()=>onSelect?.(job)} aria-label={`${service}${job.exact&&!/exact[ -]time/i.test(service)?' · Exact time':''} · ${timeLabel(job)} · ${names.client}${names.venue?' · '+names.venue:''}${job.location?' · '+job.location:''}${marker?' · '+marker:''}`}>
    <div className="job-meta"><div className="job-type"><TypeIcon kind={job.kind} size={11}/><span>{service}</span></div><div className="job-time">{timeLabel(job)}</div></div>
    <div className="job-clientline"><h3>{names.client}</h3>{marker&&<span className="window-marker" title={windowHelp}><ArrowUpRight size={11}/>{marker}</span>}</div>
    {names.venue&&<p className="job-venue">{names.venue}</p>}
    <p className={`job-address ${job.location?'':'missing-address'}`}>{job.location||'Address not listed'}</p>
  </button>;
}
function DayJobs({jobs,day,known,loading,tick,onNext,onSelect}:{jobs:Job[];day:string;known:boolean;loading:boolean;tick:number;onNext:()=>void;onSelect:(job:Job)=>void}){
  const list=useRef<HTMLDivElement>(null),measure=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState<{height:number;cards:number[]}>({height:0,cards:[]});
  useEffect(()=>{
    const box=list.current,measureBox=measure.current;if(!box||!measureBox)return;
    const update=()=>{const height=box.clientHeight,cards=Array.from(measureBox.children,el=>el.getBoundingClientRect().height);setSize(old=>old.height===height&&old.cards.length===cards.length&&old.cards.every((h,i)=>h===cards[i])?old:{height,cards});};
    const observer=new ResizeObserver(update);observer.observe(box);for(const el of measureBox.children)observer.observe(el);update();return()=>observer.disconnect();
  },[jobs]);
  const pages=packByHeight(jobs,size.cards,size.height) as Job[][],page=pages.length?tick%pages.length:0;
  return <><div className="job-list" ref={list}>
    <div className="job-measure" ref={measure} aria-hidden="true" inert>{jobs.map(job=><JobCard key={job.id} job={job} measure/>)}</div>
    <div className="job-visible">{!known?<div className="empty-day"><CalendarDays size={25}/><span>{loading?'Loading schedule':'Awaiting calendar'}</span></div>:!jobs.length?<div className="empty-day"><Check size={23}/><span>No jobs scheduled</span></div>:(pages[page]||[]).map(job=><JobCard key={job.id} job={job} onSelect={onSelect}/>)}</div>
  </div><div className="day-footer"><span>{known?`${jobs.length} scheduled item${jobs.length!==1?'s':''}`:'Not connected'}</span>{pages.length>1&&<button onClick={onNext} aria-label={`Next page of ${dateFmt(day,{weekday:'long'})} jobs`}>{page+1}/{pages.length} <ChevronRight size={12}/></button>}</div></>;
}
type ScheduleDay={day:string;jobs:Job[];count:{delivery:number;pickup:number;carryout:number;willCall:number}};
type Week={week:number;days:string[];schedule:ScheduleDay[];total:{delivery:number;pickup:number;carryout:number;willCall:number};priorityCount:number};
function WeekPanel({week,label,open,today,known,loading,tick,onToggle,onNext,onSelect}:{week:Week;label:string;open:boolean;today:string;known:boolean;loading:boolean;tick:number;onToggle:()=>void;onNext:()=>void;onSelect:(job:Job)=>void}){
  const range=`${dateFmt(week.days[0],{month:'short',day:'numeric'})} — ${dateFmt(week.days[6],{month:'short',day:'numeric'})}`;
  return <section className={`week-panel ${open?'is-expanded':''}`} aria-label={`${label}: ${range}`}>
    <div className="ahead-heading"><div><span className="eyebrow">{label}</span><h2>{range}</h2></div><div className="week-panel-actions"><div className="ahead-week-total"><span className="delivery"><b>{known?week.total.delivery:'—'}</b> deliveries</span><span className="pickup"><b>{known?week.total.pickup:'—'}</b> pickups</span><span className="will-call" title="Customer pickups at the warehouse; excludes returns"><b>{known?week.total.willCall:'—'}</b> will calls</span></div><button className="week-toggle" onClick={onToggle} aria-expanded={open} aria-controls={`week-content-${week.week}`} aria-label={`${open?'Collapse':'Expand'} ${label.toLowerCase()} jobs`}><span>{open?'Collapse':'Show jobs'}</span>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></div></div>
    {open?<div className="calendar-board" id={`week-content-${week.week}`} aria-label={`${range} Monday–Sunday jobs`}>
      {week.schedule.map(({day,jobs:dayJobs,count})=><article className={`day-column ${day===today?'today':''}`} key={day}>
        <div className="day-heading"><div><span className="day-name">{dateFmt(day,{weekday:'short'})}</span><strong>{dateFmt(day,{day:'2-digit'})}</strong></div>{day===today?<span className="today-tag">TODAY</span>:<span className="month-tag">{dateFmt(day,{month:'short'})}</span>}</div>
        <div className="daily-totals"><div className="delivery"><ArrowUpRight size={14}/><b>{known?count.delivery:'—'}</b><span>deliveries</span></div><div className="pickup"><ArrowDownLeft size={14}/><b>{known?count.pickup:'—'}</b><span>pickups</span></div><div className="will-call" title="Customer pickups at the warehouse; excludes returns"><PackageOpen size={14}/><b>{known?count.willCall:'—'}</b><span>will calls</span></div></div>
        <DayJobs jobs={dayJobs} day={day} known={known} loading={loading} tick={tick} onNext={onNext} onSelect={onSelect}/>
      </article>)}
    </div>:<div className="ahead-grid" id={`week-content-${week.week}`} aria-label={`${range} daily totals`}>{week.schedule.map(({day,count})=><div className="ahead-day" key={day}><div className="ahead-date"><span>{dateFmt(day,{weekday:'short'})}</span><b>{dateFmt(day,{day:'2-digit'})}</b></div><div className="ahead-counts"><span className="delivery"><ArrowUpRight size={13}/><b>{known?count.delivery:'—'}</b><span>deliveries</span></span><span className="pickup"><ArrowDownLeft size={13}/><b>{known?count.pickup:'—'}</b><span>pickups</span></span><span className="will-call" title="Customer pickups at the warehouse; excludes returns"><PackageOpen size={13}/><b>{known?count.willCall:'—'}</b><span>will calls</span></span></div></div>)}</div>}
  </section>;
}
export default function Dashboard(){
  const [now,setNow]=useState<Date|null>(null),[offset,setOffset]=useState(0),[feed,setFeed]=useState<Feed|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState(''),[demo,setDemo]=useState(false),[settings,setSettings]=useState(false),[url,setUrl]=useState(''),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const [expandedWeek,setExpandedWeek]=useState<number|null>(0);
  const [selected,setSelected]=useState<Job|null>(null),[autoPage,setAutoPage]=useState(true),[tick,setTick]=useState(0),[full,setFull]=useState(false);
  const dialogRef=useRef<HTMLDialogElement>(null),jobRef=useRef<HTMLDialogElement>(null),busyRef=useRef(false);
  const refresh=useCallback(async(force=false)=>{
    if(busyRef.current)return;busyRef.current=true;setLoading(true);
    try{const response=await fetch(`/api/calendar${force?'?refresh=1':''}`,{cache:'no-store'});if(response.status===401){window.location.replace('/login?next='+encodeURIComponent(window.location.pathname));return;}
      const data=await response.json() as Feed;
      if(!response.ok&&!data.connected)throw new Error(data.error||'Unable to refresh the calendar.');
      setFeed(data);setError(data.error||'');setTick(0);
    }catch(e){setError(e instanceof Error?e.message:'Unable to refresh the calendar.');}
    finally{setLoading(false);busyRef.current=false;}
  },[]);
  useEffect(()=>{setNow(new Date());void refresh(true);const poll=setInterval(()=>void refresh(true),REFRESH_INTERVAL_MS);const clock=setInterval(()=>setNow(new Date()),1000);
    const fs=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',fs);
    return()=>{clearInterval(poll);clearInterval(clock);document.removeEventListener('fullscreenchange',fs);};},[refresh]);
  useEffect(()=>{if(!autoPage)return;const timer=setInterval(()=>setTick(t=>t+1),12000);return()=>clearInterval(timer);},[autoPage]);
  useEffect(()=>{if(settings)dialogRef.current?.showModal();else dialogRef.current?.close();},[settings]);
  useEffect(()=>{if(selected)jobRef.current?.showModal();else jobRef.current?.close();},[selected]);
  const today=now?dayKey(now):dayKey(),start=shiftDay(weekStart(today),offset);
  const jobs=useMemo(()=>demo?demoJobs(start):feed?.events||[],[demo,start,feed]);
  const weeks=useMemo<Week[]>(()=>[0,1,2].map(week=>{
    const days=Array.from({length:7},(_,i)=>shiftDay(start,7*week+i));
    const schedule=days.map(day=>{const dayJobs=eventsOnDay(jobs,day) as Job[];return {day,jobs:dayJobs,count:totals(dayJobs)};});
    const weekJobs=schedule.flatMap(day=>day.jobs);
    return {week,days,schedule,total:totals(weekJobs),priorityCount:weekJobs.filter(isPriorityJob).length};
  }),[jobs,start]);
  const view=weeks[expandedWeek??0],days=view.days,viewStart=days[0],weekTotals=view.total,exactCount=view.priorityCount;
  const weekLabels=[offset===0?'THIS WEEK':'SELECTED WEEK','ONE WEEK AHEAD','TWO WEEKS AHEAD'];
  const known=demo||!!feed?.fetchedAt,stale=!!error||!!feed?.stale||!!(now&&feed?.fetchedAt&&now.getTime()-feed.fetchedAt>STALE_AFTER_MS);
  function toggleWeek(week:number){setExpandedWeek(current=>current===week?null:week);setTick(0);}
  async function connect(e:React.FormEvent){e.preventDefault();setSaving(true);setSaveError('');try{
    const response=await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});const result=await response.json() as {error?:string;success?:boolean};if(!response.ok)throw new Error(result.error||'Connection failed.');
    setUrl('');setSettings(false);setDemo(false);await refresh();
  }catch(e){setSaveError(e instanceof Error?e.message:'Connection failed.');}finally{setSaving(false);}}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('Full screen is unavailable in this embedded view. Open the dashboard in its own window.');}}
  function changeWeek(delta:number){setOffset(o=>Math.max(-28,Math.min(70,o+(expandedWeek??0)*7+delta)));setExpandedWeek(0);setTick(0);}
  return <main className="dashboard">
    <header className="topbar">
      <Brand title="Warehouse calendar"/>
      <div className="clock-block"><div className="clock">{now?new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:TIME_ZONE}).format(now):'—'}</div><div>{dateFmt(today,{weekday:'long',month:'long',day:'numeric'})} · Eastern</div></div>
      <div className="header-actions"><SignOutButton/><button className="refresh-button" aria-label="Refresh calendar now" onClick={()=>void refresh(true)} disabled={loading||demo}><RefreshCw size={16} className={loading?'spinning':''}/><span>{loading?'Refreshing…':'Refresh now'}</span></button><a className="inventory-cta" href="/inventory"><Box size={17}/><span>Inventory needed</span><ArrowUpRight size={16}/></a><button className="icon-button" title="Calendar settings" aria-label="Calendar settings" onClick={()=>setSettings(true)}><Settings2 size={20}/></button><button className="screen-button" aria-label={full?"Exit full screen":"Full screen"} onClick={fullscreen}><Expand size={17}/><span>{full?'Exit full screen':'Full screen'}</span></button></div>
    </header>
    <section className="weekbar">
      <div className="week-heading"><div className="eyebrow">{weekLabels[expandedWeek??0]} · MON–SUN</div><div className="date-navigation"><h2>{dateFmt(viewStart,{month:'long',day:'numeric'})}<span>—</span>{dateFmt(days[6],{month:days[6].slice(0,7)!==viewStart.slice(0,7)?'long':undefined,day:'numeric'})}<small>{viewStart.slice(0,4)}</small></h2><div className="nav-buttons"><button aria-label="Previous week" disabled={offset+(expandedWeek??0)*7<=-28} onClick={()=>changeWeek(-7)}><ChevronLeft size={19}/></button><button onClick={()=>{setOffset(0);setExpandedWeek(0);setTick(0);}}>This week</button><button aria-label="Next week" disabled={offset+(expandedWeek??0)*7>=70} onClick={()=>changeWeek(7)}><ChevronRight size={19}/></button></div></div></div>
      <div className="week-stats" aria-label={demo?'Sample week totals':'Jobs in the selected week'}><div><span className="stat-icon delivery"><ArrowUpRight size={22}/></span><strong>{known?weekTotals.delivery:'—'}</strong><span>deliveries</span></div><div><span className="stat-icon pickup"><ArrowDownLeft size={22}/></span><strong>{known?weekTotals.pickup:'—'}</strong><span>pickups</span></div><div title="Customer pickups at the warehouse; excludes returns"><span className="stat-icon will-call"><PackageOpen size={20}/></span><strong>{known?weekTotals.willCall:'—'}</strong><span>will calls</span></div><div><span className="stat-icon exact"><Clock3 size={20}/></span><strong>{known?exactCount:'—'}</strong><span>priority jobs</span></div></div>
    </section>
    {demo?<div className="notice demo-notice"><span><strong>Sample schedule</strong> · These are examples, not warehouse jobs.</span><button onClick={()=>setDemo(false)}>Exit preview <X size={14}/></button></div>:
      !feed?.connected&&!loading?<div className="notice connect-notice"><span><Link2 size={17}/><strong>Connect your calendar</strong><span> Add the private feed to display your live deliveries and pickups.</span></span><div><button onClick={()=>setDemo(true)}>Preview layout</button><button className="solid-button" onClick={()=>setSettings(true)}>Connect calendar <ArrowUpRight size={14}/></button></div></div>:
      stale?<div className="notice stale-notice" role="status"><span><AlertTriangle size={17}/><strong>{feed?.fetchedAt?'Showing the last saved schedule.':'Calendar unavailable.'}</strong> {error||'The last successful update is more than 75 minutes old.'}</span><button onClick={()=>void refresh(true)}>Retry</button></div>:null}
    <div className={`week-panels ${expandedWeek===null?'all-collapsed':''}`}>
      {weeks.map(week=><WeekPanel key={week.week} week={week} label={weekLabels[week.week]} open={expandedWeek===week.week} today={today} known={known} loading={loading} tick={tick} onToggle={()=>toggleWeek(week.week)} onNext={()=>setTick(t=>t+1)} onSelect={setSelected}/>)}
    </div>
    <footer className="statusbar"><div className="connection-status"><span className={`status-dot ${demo?'sample':stale?'warning':feed?.connected?'live':''}`}/><strong>{demo?'Sample data':feed?.connected?'Contract Signed - GSPro':'Calendar not connected'}</strong><span>{feed?.fetchedAt&&!demo?`Updated ${timeFmt(new Date(feed.fetchedAt).toISOString())}`:'Ready for setup'}</span><span className="refresh-cadence">Auto-refresh hourly</span></div><div className="footnote">“May deliver” marks the next day in a delivery window. Jobs count on the first day only.</div><button className="auto-page" onClick={()=>setAutoPage(v=>!v)} title="Busy days cycle through all their jobs every 12 seconds">{autoPage?<Pause size={12}/>:<Play size={12}/>} {autoPage?'Auto-page on':'Auto-page off'}{autoPage?' · 12s':''}</button></footer>
    <dialog ref={dialogRef} className="setup-dialog" onCancel={()=>setSettings(false)} onClick={e=>{if(e.target===e.currentTarget&&!saving)setSettings(false);}}><form onSubmit={connect}><div className="dialog-heading"><div className="dialog-icon"><Link2 size={22}/></div><button type="button" aria-label="Close calendar settings" onClick={()=>setSettings(false)} disabled={saving}><X size={21}/></button></div><div className="eyebrow">ONE-TIME SETUP</div><h2>{feed?.connected?'Calendar connection':'Connect your crew calendar'}</h2><p>Read deliveries and pickups directly from <strong>Contract Signed - GSPro</strong>. Your private link is saved securely for this protected warehouse dashboard.</p>
      <ol><li>In Google Calendar, open <strong>Settings and sharing</strong> for Contract Signed - GSPro.</li><li>Choose <strong>Integrate calendar</strong>.</li><li>Copy <strong>Secret address in iCal format</strong> and paste it below.</li></ol>
      <label htmlFor="feed-url">Private calendar feed</label><input autoComplete="off" spellCheck={false} id="feed-url" type="password" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…" required maxLength={2000}/>
      <p className="setup-small">The dashboard refreshes every hour while open. Use Refresh now for an earlier update. Google’s feed may take additional time to reflect changes. {feed?.connected?'Saving a new link replaces your current connection.':''}</p>
      {saveError&&<div className="form-error" role="alert">{saveError}</div>}<button className="connect-submit" type="submit" disabled={saving||!url.trim()}>{saving?<><RefreshCw size={16} className="spinning"/> Checking calendar…</>:<>Connect calendar <ArrowUpRight size={17}/></>}</button><button type="button" className="preview-button" onClick={()=>{setDemo(true);setSettings(false);}}>Preview with sample jobs</button>
    </form></dialog>
    <dialog ref={jobRef} className="job-dialog" aria-labelledby="event-details-title" onCancel={()=>setSelected(null)} onClick={e=>{if(e.target===e.currentTarget)setSelected(null);}}>{selected&&<JobDetails job={selected} onClose={()=>setSelected(null)}/>}</dialog>
  </main>;
}
