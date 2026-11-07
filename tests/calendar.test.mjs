import {parseCalendar} from '../lib/ical.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {appearsOn,eventsOnDay,totals,classify,isExact,dayKey,validFeedUrl,CALENDAR_ID,jobNames,shiftDay,weekStart,serviceLabel,deliveryWindowEnd,packByHeight,isWillCall} from '../lib/calendar.mjs';
const now=new Date('2026-11-06T12:00:00Z');
const ics=(events)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Warehouse//EN\r\n${events}\r\nEND:VCALENDAR`;
const event=(s)=>`BEGIN:VEVENT\r\n${s}\r\nEND:VEVENT`;
const timed=(uid,title,start='20261107T190000Z',end=start)=>event(`UID:${uid}\r\nSUMMARY:${title}\r\nDTSTART:${start}\r\nDTEND:${end}`);
test('Exact Time is highlighted in any case or hyphenation',()=>{for(const title of ['Exact Time Delivery','EXACT TIME PICKUP','exact-time'])assert.equal(isExact(title),true);assert.equal(isExact('Exact Day Delivery'),false);});
test('pickup overrides Delivery word; carry-outs are separate',()=>{assert.equal(classify('Standard Delivery - (Pickup)'), 'pickup');assert.equal(classify('Standard Delivery - (Drop-Off)'),'delivery');assert.equal(classify('Order Prep Fee - (Carry-Out)'),'carryout');assert.equal(classify('Customer pickup'),'carryout');});
test('Google private feeds restricted to the intended calendar',()=>{const u=`https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/private-abc123/basic.ics`;assert.ok(validFeedUrl(u));for(const other of [u.replace('https:','http:'),u.replace('calendar.google.com','evil.com'),u.replace('private-','public-'),u+'?secret=x',u.replace('c_c9lbmd56','different')])assert.equal(validFeedUrl(other),false);});
test('Eastern date stays correct across midnight and daylight saving',()=>{assert.equal(dayKey('2026-11-07T03:00:00Z'),'2026-11-06');assert.equal(dayKey('2026-07-07T03:00:00Z'),'2026-07-06');});
test('A Thursday–Friday window appears and counts only on Thursday',()=>{const [job]=parseCalendar(ics(timed('x','Standard Delivery - (Drop-Off)','20261105T130000Z','20261106T230000Z')),now);assert.ok(appearsOn(job,'2026-11-05'));assert.equal(appearsOn(job,'2026-11-06'),false);assert.equal(appearsOn(job,'2026-11-07'),false);assert.equal(totals(eventsOnDay([job],'2026-11-05')).delivery,1);assert.equal(totals(eventsOnDay([job],'2026-11-06')).delivery,0);});
test('Midnight end is exclusive and zero duration still appears',()=>{const [job]=parseCalendar(ics(timed('x','Pickup','20261106T180000Z','20261107T050000Z')),now);assert.equal(appearsOn(job,'2026-11-07'),false);const [exact]=parseCalendar(ics(timed('y','Exact Time Delivery')),now);assert.ok(appearsOn(exact,'2026-11-07'));});
test('Multi-day all-day events also appear only on their start date',()=>{const [job]=parseCalendar(ics(event('UID:all\r\nSUMMARY:Delivery\r\nDTSTART;VALUE=DATE:20261106\r\nDTEND;VALUE=DATE:20261108')),now);assert.ok(appearsOn(job,'2026-11-06'));assert.equal(appearsOn(job,'2026-11-07'),false);assert.equal(appearsOn(job,'2026-11-08'),false);});
test('Cancelled jobs never affect totals',()=>{assert.equal(parseCalendar(ics(event('UID:cancel\r\nSTATUS:CANCELLED\r\nSUMMARY:Delivery\r\nDTSTART:20261107T190000Z')),now).length,0);});
test('Recurring exceptions and excluded dates are honored',()=>{
 const master=event('UID:recur\r\nSUMMARY:Delivery\r\nDTSTART:20261106T150000Z\r\nDTEND:20261106T160000Z\r\nRRULE:FREQ=DAILY;COUNT=4\r\nEXDATE:20261107T150000Z');
 const exception=event('UID:recur\r\nRECURRENCE-ID:20261108T150000Z\r\nSUMMARY:Exact Time Delivery\r\nDTSTART:20261108T180000Z\r\nDTEND:20261108T190000Z');
 const jobs=parseCalendar(ics(master+'\r\n'+exception),now);assert.equal(jobs.length,3);assert.equal(jobs.filter(j=>j.exact).length,1);assert.ok(jobs.some(j=>j.start==='2026-11-08T18:00:00.000Z'));
});
test('Folded titles and escaped location text are decoded',()=>{const [job]=parseCalendar(ics(event('UID:fold\r\nSUMMARY:Exact Time Delivery :: A very\r\n long event\r\nLOCATION:10 Main St\\, NJ\r\nDTSTART:20261107T190000Z')),now);assert.equal(job.title,'Exact Time Delivery :: A verylong event');assert.equal(job.location,'10 Main St, NJ');});
test('Service fees attach to the matching stop without doubling its count',()=>{const jobs=parseCalendar(ics(timed('delivery','Exact Day Delivery - (Drop-Off) :: Example')+'\r\n'+timed('fee','Elevator Fee (Drop-Off) :: Example')+'\r\n'+timed('carryout','Order Prep Fee - (Carry-Out) :: Other')),now);const day=eventsOnDay(jobs,'2026-11-07');assert.deepEqual(totals(day),{delivery:1,pickup:0,carryout:1,willCall:1});assert.equal(day[0].notes.length,1);});
test('Distinct pickups for different clients remain separate',()=>{const jobs=parseCalendar(ics(timed('one','Standard Delivery (Pickup) :: Client A')+'\r\n'+timed('two','Standard Delivery (Pickup) :: Client B')),now);assert.equal(totals(eventsOnDay(jobs,'2026-11-07')).pickup,2);});
test('Crew names exclude project titles, dates, and street addresses',()=>{
 assert.deepEqual(jobNames({title:'Exact Time Delivery :: Novoa - Hilton Parsippany',location:'1 Hilton Ct, NJ'}),{client:'Novoa',venue:'Hilton Parsippany'});
 assert.deepEqual(jobNames({title:'Pickup :: Zizzo - Indian Trail Club [November 2026]',location:'830 Franklin Lake Rd, NJ'}),{client:'Zizzo',venue:'Indian Trail Club'});
 assert.deepEqual(jobNames({title:'Delivery :: Sommer - 300 Kimball Dr (November)',location:'300 Kimball Dr, NJ'}),{client:'Sommer',venue:''});
 assert.deepEqual(jobNames({title:'Delivery :: Smith - Annual Gala',location:'The Grand Hotel, 9 Main St'}),{client:'Smith',venue:'The Grand Hotel'});
 assert.deepEqual(jobNames({title:'Delivery :: Smith - Annual Gala',location:'9 Main St'}),{client:'Smith',venue:''});
 assert.deepEqual(jobNames({title:'Carry-out :: Bonanno',location:''}),{client:'Bonanno',venue:''});
});
test('Following-week totals count each movement once on its Eastern start day',()=>{
 const jobs=parseCalendar(ics(timed('prior','Delivery','20261112T130000Z','20261113T230000Z')+'\r\n'+timed('delivery','Delivery','20261113T130000Z','20261114T230000Z')+'\r\n'+timed('pickup','Pickup','20261119T130000Z','20261120T230000Z')+'\r\n'+timed('later','Delivery','20261120T130000Z','20261121T230000Z')),now);
 const week=Array.from({length:7},(_,i)=>totals(eventsOnDay(jobs,shiftDay('2026-11-13',i))));
 assert.equal(week.reduce((n,c)=>n+c.delivery,0),1);assert.equal(week.reduce((n,c)=>n+c.pickup,0),1);assert.equal(week[0].delivery,1);assert.equal(week[1].delivery,0);assert.equal(week[6].pickup,1);
});

test('Delivery service names distinguish exact time, exact day, short window, and standard',()=>{
 for(const type of ['Standard','Exact Time','Exact Day','Short Window','After Hours']){
  assert.equal(serviceLabel({kind:'delivery',title:`${type} Delivery - (Drop-Off) :: Smith - Venue`}),`${type} Delivery`);
  assert.equal(serviceLabel({kind:'pickup',title:`${type} Delivery - (Pickup) :: Smith - Venue`}),`${type} Pickup`);
 }
 assert.equal(serviceLabel({kind:'carryout',title:'Order Prep Fee - (Carry-Out) :: Smith'}),'Will call');
});
test('Next-day delivery markers respect Eastern dates and exclusive ends',()=>{
 const job={kind:'delivery',allDay:false,start:'2026-11-12T13:00:00Z',end:'2026-11-13T23:00:00Z'};
 assert.equal(deliveryWindowEnd(job),'2026-11-13');
 assert.equal(deliveryWindowEnd({...job,end:'2026-11-13T05:00:00Z'}),'');
 assert.equal(deliveryWindowEnd({...job,kind:'pickup'}),'');
 assert.equal(deliveryWindowEnd({...job,end:job.start}),'');
 assert.equal(deliveryWindowEnd({...job,allDay:true,start:'2026-11-12',end:'2026-11-14'}),'2026-11-13');
 assert.equal(deliveryWindowEnd({...job,allDay:true,start:'2026-11-12',end:'2026-11-13'}),'');
 assert.equal(deliveryWindowEnd({...job,start:'2026-11-13T03:00:00Z',end:'2026-11-13T06:00:00Z'}),'2026-11-13');
});
test('Variable-height pages fit more compact jobs without losing or duplicating any',()=>{
 const jobs=Array.from({length:9},(_,i)=>i),heights=[45,60,45,45,60,45,45,60,45];
 const pages=packByHeight(jobs,heights,300);
 assert.deepEqual(pages,[[0,1,2,3,4],[5,6,7,8]]);
 assert.deepEqual(pages.flat(),jobs);
 for(const page of pages)assert.ok(page.reduce((sum,i)=>sum+heights[i],0)+(page.length-1)*5<=300);
 assert.deepEqual(packByHeight(['large','small'],[400,40],200),[['large'],['small']]);
 assert.deepEqual(packByHeight([],[],200),[]);
 assert.deepEqual(packByHeight(['a','b'],[50,50],105),[['a','b']]);
});


test('Weeks stay Monday–Sunday through weekends, year changes and Eastern midnight',()=>{
 for(const [day,monday] of [['2026-11-02','2026-11-02'],['2026-11-06','2026-11-02'],['2026-11-08','2026-11-02'],['2026-11-09','2026-11-09'],['2027-01-01','2026-12-28'],['2026-03-08','2026-03-02']])assert.equal(weekStart(day),monday);
 assert.equal(weekStart(dayKey('2026-11-09T04:30:00Z')),'2026-11-02');
 assert.equal(weekStart(dayKey('2026-11-09T05:00:00Z')),'2026-11-09');
 const start=weekStart('2026-11-06');
 assert.deepEqual([0,7,14].map(offset=>[shiftDay(start,offset),shiftDay(start,offset+6)]),[['2026-11-02','2026-11-08'],['2026-11-09','2026-11-15'],['2026-11-16','2026-11-22']]);
});
test('Feed retains full Monday–Sunday weeks at both navigation limits',()=>{
 const source=ics(timed('old','Delivery','20261005T120000Z','20261005T130000Z')+'\r\n'+timed('late','Delivery','20270201T043000Z','20270201T044500Z'));
 const jobs=parseCalendar(source,now);
 assert.equal(eventsOnDay(jobs,'2026-10-05').length,1);
 assert.equal(eventsOnDay(jobs,'2027-01-31').length,1);
});


test('Every red job sorts ahead of standard jobs, with scheduled time ordering within each group',()=>{
 const jobs=parseCalendar(ics([
  timed('standard-early','Standard Delivery :: Early client','20261107T120000Z','20261107T130000Z'),
  timed('exact-time','Exact Time Delivery :: Time client','20261107T180000Z','20261107T190000Z'),
  timed('short-window','Short Window Delivery - (Pickup) :: Window client','20261107T160000Z','20261107T170000Z'),
  timed('exact-day','Exact Day Delivery :: Day client','20261107T140000Z','20261107T150000Z'),
  timed('standard-late','Standard Delivery :: Late client','20261107T200000Z','20261107T210000Z')
 ].join('\r\n')),now);
 const ordered=eventsOnDay(jobs,'2026-11-07');
 assert.deepEqual(ordered.map(job=>job.id.split(':')[0]),['exact-day','short-window','exact-time','standard-early','standard-late']);
 assert.deepEqual(packByHeight(ordered,[60,60,60,60,60],190).map(page=>page.map(job=>job.id.split(':')[0])),[['exact-day','short-window','exact-time'],['standard-early','standard-late']]);
});


test('Will-call totals count customer pickups only, never returns or crew pickups',()=>{
 const jobs=parseCalendar(ics([
  timed('out','🚶 Order Prep Fee - (Carry-Out) :: Customer A','20261106T150000Z','20261106T220000Z'),
  timed('return','🚶 Order Prep Fee - (Return) :: Customer B','20261106T140000Z','20261106T220000Z'),
  timed('crew','Standard Delivery - (Pickup) :: Customer C','20261106T130000Z','20261106T230000Z'),
  timed('will-call','Will Call - Pickup :: Customer D','20261107T150000Z','20261108T180000Z'),
  timed('title-only','Standard Delivery :: Client - Will Call Gala','20261107T130000Z','20261107T230000Z'),
  timed('return-only','Customer Return :: Customer E','20261109T140000Z','20261109T220000Z'),
  timed('next-week','Customer Pickup :: Customer F','20261112T150000Z','20261112T220000Z')
 ].join('\r\n')),now);
 const friday=eventsOnDay(jobs,'2026-11-06');
 assert.deepEqual(totals(friday),{delivery:0,pickup:1,carryout:2,willCall:1});
 assert.equal(serviceLabel(friday.find(j=>j.id.startsWith('out:'))),'Will call');
 assert.equal(serviceLabel(friday.find(j=>j.id.startsWith('return:'))),'Customer return');
 assert.equal(isWillCall({kind:'carryout',title:'Order Prep Fee - (Carry-Out) :: Return Family'}),true);
 assert.equal(totals(eventsOnDay(jobs,'2026-11-07')).willCall,1);
 assert.equal(totals(eventsOnDay(jobs,'2026-11-08')).willCall,0);
 assert.equal(totals(eventsOnDay(jobs,'2026-11-07')).delivery,1);
 const week=start=>totals(Array.from({length:7},(_,i)=>eventsOnDay(jobs,shiftDay(start,i))).flat()).willCall;
 assert.equal(week('2026-11-02'),2);assert.equal(week('2026-11-09'),1);
});
