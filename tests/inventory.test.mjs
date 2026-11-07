import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryDetails,inventoryForWeek} from '../lib/inventory.mjs';
import {calendarStream} from '../lib/ics-stream.mjs';
import {parseCalendar} from '../lib/ical.mjs';
import {encodeIcsText} from '../lib/calendar-details.mjs';
import {eventsOnDay,totals} from '../lib/calendar.mjs';

const details='Client: Jamie Jones Client #: private-phone **\\---- Rental Items for Nov 7, 2026 (Top-\nlevel only) ----** Item: Plastic Folding Chair - White (Qty: 50) Item: Stage Kit (12" Height) (Qty: 1) Item: Rental Protection Plan (RPP) (Qty: 1) **\\---- Glassware for Nov 7, 2026 (Top-level only) ----** Item: Wine Glass &amp; Stem (Qty: 36) Item: Cleaning Fee [Dishware] (Qty: 1) Item: Minimum Requirement (Qty: 1) **\\---- Labor for Nov 7, 2026 (Top-level only) ----** Item: Setup and Strike (Qty: 1) **\\---- Logistics ----** Item: Standard Delivery - Drop-Off (Qty: 1)';
test('Equipment sections include custom categories, preserve kits, and omit fees and labor',()=>{
  assert.deepEqual(inventoryDetails(details),{inventoryAvailable:true,items:[{name:'Plastic Folding Chair - White',quantity:50},{name:'Stage Kit (12" Height)',quantity:1},{name:'Wine Glass & Stem',quantity:36}]});
  assert.deepEqual(inventoryDetails('No equipment details'),{items:[],inventoryAvailable:false});
  assert.equal(inventoryDetails('---- Rental Items for Nov 7 (Top-level only) ---- Item: Unfinished').inventoryAvailable,false);
});
test('Inventory metadata and full event details survive streaming',()=>{
  const source=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:inventory\r\nSUMMARY:Standard Delivery - Drop-Off :: Jones\r\nDTSTART:20261107T130000Z\r\nDTEND:20261108T220000Z\r\nDESCRIPTION:${encodeIcsText(details)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const now=new Date('2026-11-06T12:00:00Z'),stream=calendarStream(now);stream.write(source);
  const reduced=stream.finish();assert.ok(reduced.includes('private-phone'));
  const [job]=parseCalendar(reduced,now);assert.equal(job.inventoryAvailable,true);assert.equal(job.items.length,3);assert.equal(job.items[2].name,'Wine Glass & Stem');
});
const job=(id,day,extra={})=>({id,project:id,title:'Standard Delivery :: Example',client:'Jamie Jones',location:'',start:`${day}T13:00:00Z`,end:`${day}T22:00:00Z`,allDay:false,kind:'delivery',items:[{name:'Chair',quantity:50}],inventoryAvailable:true,...extra});
test('One project list per first outgoing day; exclude pickups, returns, fees and later weeks',()=>{
  const data=[job('p1','2026-11-06',{end:'2026-11-07T22:00:00Z'}),job('p1','2026-11-07'),job('p1','2026-11-09',{kind:'pickup'}),job('p2','2026-11-08',{kind:'carryout',title:'Order Prep Fee - (Carry-Out) :: Smith'}),job('p2','2026-11-10',{kind:'carryout',title:'Order Prep Fee - (Return) :: Smith'}),job('p3','2026-11-05'),job('p3','2026-11-08'),job('p4','2026-11-13'),job('p5','2026-11-09',{fee:true}),job('p6','2026-11-09',{kind:'pickup'}),job('p7','2026-11-10',{inventoryAvailable:false,items:[]})];
  const result=inventoryForWeek(data,'2026-11-06');
  assert.equal(result.projectCount,3);assert.equal(result.rows[0].quantity,100);assert.equal(result.rows[0].neededBy,'2026-11-06');assert.equal(result.rows[0].allocations.length,2);assert.equal(result.missing.length,1);
});
test('All-day outgoing dates and inclusive seventh-day boundary remain intact',()=>{
  const result=inventoryForWeek([job('a','2026-11-12',{start:'2026-11-12',end:'2026-11-13',allDay:true}),job('b','2026-11-13',{start:'2026-11-13',end:'2026-11-14',allDay:true})],'2026-11-06');
  assert.equal(result.projectCount,1);assert.equal(result.rows[0].neededBy,'2026-11-12');
});
test('A rush charge on the same delivery does not become another delivery or inventory list',()=>{
  const event=title=>`BEGIN:VEVENT\r\nUID:${title}\r\nSUMMARY:${title} - (Drop-Off) :: Example\r\nDTSTART:20261108T130000Z\r\nDTEND:20261108T230000Z\r\nDESCRIPTION:https://pro.goodshuffle.com/app/project/detail?id=123\r\nEND:VEVENT`;
  const jobs=parseCalendar(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${event('Exact Day Delivery')}\r\n${event('Rush Fee')}\r\nEND:VCALENDAR`,new Date('2026-11-06T12:00:00Z'));
  const stops=eventsOnDay(jobs,'2026-11-08');assert.equal(totals(stops).delivery,1);assert.equal(stops[0].notes.length,1);
});
