import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDetails,calendarDescription,encodeIcsText} from '../lib/calendar-details.mjs';
import {calendarStream} from '../lib/ics-stream.mjs';
import {parseCalendar} from '../lib/ical.mjs';
import {jobNames,isPriorityJob} from '../lib/calendar.mjs';

test('Full client names and venues come from calendar labels, not project names',()=>{
  const details=calendarDetails('Status: Contract Signed Project: Jones - Annual Gala (123) Venue: Grand Hotel Event Date/Time: Saturday, 11/7 Client: Jamie Elizabeth Jones Client #: 555-0100 Sales Lead: Someone Else Item Category Pullsheet: Printed');
  assert.deepEqual(details,{client:'Jamie Elizabeth Jones',venue:'Grand Hotel'});
  assert.deepEqual(jobNames({title:'Delivery :: Jones - Annual Gala',location:'1 Main St',...details}),details);
});
test('HTML, escaped entities, and wrapped fields preserve full names',()=>{
  assert.deepEqual(calendarDetails('<b>Venue:</b> Lakeside &amp; Garden Club<br><b>Client:</b> Ana Mar&iacute;a O&#39;Brien<br>Client #: 555-0100'),{client:"Ana María O'Brien",venue:'Lakeside & Garden Club'});
  assert.deepEqual(calendarDetails('Project: Smith\nClient:\nMorgan Smith\nClient #: 555-0100'),{client:'Morgan Smith',venue:''});
  assert.deepEqual(calendarDetails('Project: Smith'),{client:'',venue:''});
  assert.deepEqual(calendarDetails('Contract Notes: Client: Not the real client'),{client:'',venue:''});
});
test('Streamed calendar keeps full client, venue, address, and readable event description',()=>{
  const description='<b>Status:</b> Contract Signed<br><b>Venue:</b> Grand Hotel<br><b>Client:</b> Jamie Jones, Jr.<br><b>Client #:</b> 555-0100<br><b>Sales Lead:</b> Another Person<br>Contract Notes: Private notes https://pro.goodshuffle.com/app/project/detail?id=12345';
  const source=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:metadata\r\nSUMMARY:Exact Day Delivery :: Jones - Grand Hotel\r\nLOCATION:1 Main St\\, NJ\r\nDTSTART:20261107T130000Z\r\nDTEND:20261107T230000Z\r\nDESCRIPTION:${encodeIcsText(description)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const now=new Date('2026-11-06T12:00:00Z'),stream=calendarStream(now);
  for(let i=0;i<source.length;i+=17)stream.write(source.slice(i,i+17));
  const reduced=stream.finish();
  assert.ok(reduced.includes('555-0100'));assert.ok(reduced.includes('Private notes'));
  const [job]=parseCalendar(reduced,now);
  assert.equal(job.client,'Jamie Jones, Jr.');assert.equal(job.venue,'Grand Hotel');assert.equal(job.location,'1 Main St, NJ');assert.equal(job.project,'12345');
  assert.match(job.description,/Client #: 555-0100/);assert.match(job.description,/Contract Notes: Private notes/);assert.ok(!job.description.includes('<br>'));assert.equal(job.descriptionTruncated,false);
});
test('Street-only venue fields do not duplicate the address on the card',()=>{
  assert.deepEqual(jobNames({title:'Delivery :: Smith - 10 Main St',client:'Morgan Smith',venue:'10 Main St',location:'10 Main St, Exampletown, NJ'}),{client:'Morgan Smith',venue:''});
});
test('Exact-day, exact-time, and short-window movements take red priority',()=>{
  for(const kind of ['delivery','pickup'])for(const type of ['Exact Day','Exact Time','exact-day','EXACT TIME','Short Window','short-window'])assert.ok(isPriorityJob({kind,title:`${type} Delivery - (Pickup) :: Client`,exact:false}));
  for(const type of ['Standard','After Hours'])assert.equal(isPriorityJob({kind:'pickup',title:`${type} Delivery - (Pickup) :: Client`,exact:false}),false);
  assert.equal(isPriorityJob({kind:'delivery',title:'Standard Delivery :: Exact Day gala',exact:false}),false);
  assert.equal(isPriorityJob({kind:'carryout',title:'Exact Day Carry-Out',exact:false}),false);
});

test('Descriptions preserve paragraphs, links, and list content without executable HTML',()=>{
  const input='<p>Delivery &amp; setup</p><p>Use the rear entrance.<br>Call on arrival.</p><ul><li>50 chairs</li><li>6 tables</li></ul><a href="https://example.com/pullsheet?a=1&amp;b=2">Pullsheet</a><script>alert(1)</script><iframe src="https://example.com">hidden frame</iframe>';
  const text=calendarDescription(input);
  assert.match(text,/Delivery & setup\n\nUse the rear entrance.\nCall on arrival./);
  assert.match(text,/• 50 chairs\n• 6 tables/);
  assert.match(text,/Pullsheet \(https:\/\/example.com\/pullsheet\?a=1&b=2\)/);
  assert.ok(!text.includes('<'));assert.ok(!text.includes('alert(1)'));assert.ok(!text.includes('hidden frame'));
});

test('Plain-text description punctuation and multiline instructions survive the feed',()=>{
  const description='Client: Ana María O\'Brien\nClient #: 555-0100\nContract Notes: Bring chairs, tables; use entrance B.\nSecond line: C:\\Loading\\Dock';
  const now=new Date('2026-11-06T12:00:00Z'),stream=calendarStream(now);
  stream.write(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:full-details\nSUMMARY:Standard Delivery\nDTSTART:20261107T130000Z\nDTEND:20261107T230000Z\nDESCRIPTION:${encodeIcsText(description)}\nEND:VEVENT\nEND:VCALENDAR`);
  const [job]=parseCalendar(stream.finish(),now);
  assert.equal(job.description,description);
});
