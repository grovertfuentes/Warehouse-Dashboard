'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Box,PackageOpen,RefreshCw,Search,AlertTriangle} from 'lucide-react';
import Brand from '../brand';
import {SignOutButton} from '../session-controls';
import {dayKey,shiftDay,TIME_ZONE,REFRESH_INTERVAL_MS} from '../../lib/calendar.mjs';
import {inventoryForWeek} from '../../lib/inventory.mjs';

type InventoryJob={id:string;title:string;client?:string;venue?:string;location:string;start:string;end:string;allDay:boolean;kind:string;project?:string;fee?:boolean;items?:{name:string;quantity:number}[];inventoryAvailable?:boolean};
type Feed={connected:boolean;events:InventoryJob[];fetchedAt:number|null;stale?:boolean;error?:string};
type ItemRow={name:string;quantity:number;neededBy:string;allocations:{id:string;client:string;day:string;quantity:number}[]};
const dateLabel=(day:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
const quantity=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);

export default function Inventory(){
  const [today,setToday]=useState<string|null>(null),[feed,setFeed]=useState<Feed|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState('');
  const busy=useRef(false);
  const refresh=useCallback(async(force=false)=>{
    if(busy.current)return;busy.current=true;setLoading(true);
    try{
      const response=await fetch(`/api/calendar${force?'?refresh=1':''}`,{cache:'no-store'});
      if(response.status===401){window.location.replace('/login?next='+encodeURIComponent(window.location.pathname));return;}
      const data=await response.json() as Feed;
      if(!response.ok&&!data.connected)throw new Error(data.error||'Unable to load inventory.');
      setFeed(data);setError(data.error||'');
    }catch(e){setError(e instanceof Error?e.message:'Unable to load inventory.');}
    finally{setLoading(false);busy.current=false;}
  },[]);
  useEffect(()=>{
    setToday(dayKey());void refresh(true);
    const timer=setInterval(()=>void refresh(true),REFRESH_INTERVAL_MS);
    const clock=setInterval(()=>setToday(dayKey()),60000);
    return()=>{clearInterval(timer);clearInterval(clock);};
  },[refresh]);
  const inventory=useMemo(()=>inventoryForWeek(feed?.events||[],today||dayKey()),[feed,today]);
  const rows=(inventory.rows as ItemRow[]).filter(row=>row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const known=!!feed?.fetchedAt;
  return <main className="inventory-screen">
    <header className="topbar"><Brand title="Inventory needed"/><div className="header-actions"><SignOutButton/><a href="/" className="back-calendar"><ArrowLeft size={17}/>Back to calendar</a></div></header>
    <section className="inventory-overview">
      <div><div className="eyebrow">PREP AHEAD · NEXT 7 DAYS</div><h2>{today?`${dateLabel(today)} — ${dateLabel(shiftDay(today,6))}`:'Loading dates…'}</h2><p>Equipment for scheduled deliveries and customer carry-outs.</p></div>
      <div className="inventory-summary"><div><strong>{known?inventory.rows.length:'—'}</strong><span>different items</span></div><div><strong>{known?inventory.projectCount:'—'}</strong><span>outgoing projects</span></div></div>
    </section>
    {error||feed?.stale?<div className="notice stale-notice" role="status"><span><AlertTriangle size={17}/><strong>{known?'Showing the last saved list.':'Inventory unavailable.'}</strong> {error}</span><button onClick={()=>void refresh(true)}>Retry</button></div>:null}
    {known&&inventory.missing.length>0?<div className="inventory-warning" role="status"><AlertTriangle size={18}/><div><strong>{inventory.missing.length} project{inventory.missing.length===1?' has':'s have'} incomplete item details.</strong><p>{inventory.missing.map((job:{client:string;day:string})=>`${job.client} (${dateLabel(job.day)})`).join(' · ')}. Check the project pullsheet before loading.</p></div></div>:null}
    <section className="inventory-list" aria-label="Rental equipment needed">
      <div className="inventory-toolbar"><div><Box size={19}/><h3>Rental item totals</h3></div><div className="inventory-controls"><label className="item-search"><Search size={16}/><input type="search" aria-label="Search inventory items" placeholder="Find an item…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="icon-button" aria-label="Refresh inventory" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={17} className={loading?'spinning':''}/></button></div></div>
      {!known?<div className="inventory-screen-empty"><PackageOpen size={40}/><h3>{loading?'Loading your equipment list…':feed?.connected?'Waiting for calendar details':'Connect your calendar to see inventory'}</h3><p>{loading?'Reading the latest calendar items.':feed?.connected?'Use Refresh to try again.':'Connect the crew calendar from the calendar settings.'}</p>{!loading&&!feed?.connected?<a href="/">Back to calendar <ArrowLeft size={14}/></a>:null}</div>:
      !rows.length?<div className="inventory-screen-empty"><PackageOpen size={40}/><h3>{search?'No matching items':inventory.projectCount?'No rental items listed':'No outgoing jobs in the next 7 days'}</h3><p>{search?'Try another item name.':inventory.projectCount?'Check the project pullsheets for equipment details.':'Items will appear here as deliveries and carry-outs are scheduled.'}</p></div>:
      <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th scope="col">Item / project breakdown</th><th scope="col">Quantity needed</th><th scope="col">First needed</th></tr></thead><tbody>{rows.map(row=><tr key={row.name}><td><details><summary>{row.name}<span>{row.allocations.length} project{row.allocations.length===1?'':'s'} · view breakdown</span></summary><ul>{row.allocations.map(allocation=><li key={allocation.id}><span>{allocation.client}<small>{dateLabel(allocation.day)}</small></span><b>× {quantity(allocation.quantity)}</b></li>)}</ul></details></td><td className="inventory-quantity">{quantity(row.quantity)}</td><td>{dateLabel(row.neededBy)}</td></tr>)}</tbody></table></div>}
    </section>
    <footer className="inventory-notes"><p>Counts each project once on its first scheduled outgoing date. Calendar items are shown as listed; packages and kits are not broken into components. Check pullsheets for the complete loading list.</p><span><span className={`status-dot ${feed?.stale||error?'warning':feed?.connected?'live':''}`}/>{known?`Updated ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:TIME_ZONE}).format(new Date(feed!.fetchedAt!))} · Eastern`:'Awaiting calendar'}</span></footer>
  </main>;
}
