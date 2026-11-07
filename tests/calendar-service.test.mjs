import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalendarService} from '../lib/calendar-service.mjs';
import {warehouseAccessAllowed,warehouseOriginAllowed} from '../lib/warehouse-access.mjs';
const event={id:'job',description:'Loading entrance B',inventoryAvailable:true};
const old={feedUrl:'private-test-feed',events:[event],fetchedAt:1000,updatedAt:1000};
function fixture(initial=old){
  let state=initial,reads=0,fail=false,now=40000;
  const service=createCalendarService({readState:async()=>({state,etag:'version-1'}),writeState:async(next,etag)=>{assert.equal(etag,'version-1');state=next;},readFeed:async()=>{reads++;if(fail)throw new Error('Private source unavailable');return [{...event,id:'fresh'}];},now:()=>now});
  return {service,get state(){return state;},get reads(){return reads;},set fail(value){fail=value;},set now(value){now=value;}};
}
test('First connection is explicit; private feed URLs never appear in API results',async()=>{
  const f=fixture(null);assert.deepEqual(await f.service.read(),{connected:false,events:[],fetchedAt:null});
  assert.deepEqual(await f.service.connect('private-test-feed'),{success:true});
  assert.equal(f.state.feedUrl,'private-test-feed');assert.equal(f.state.events[0].id,'fresh');
  assert.ok(!JSON.stringify(await f.service.read()).includes('private-test-feed'));
});
test('Hourly refresh, manual refresh, and short burst caching preserve the schedule',async()=>{
  const f=fixture();assert.equal((await f.service.read()).events[0].id,'job');assert.equal(f.reads,0);
  assert.equal((await f.service.read(true)).events[0].id,'fresh');assert.equal(f.reads,1);
  await f.service.read(true);assert.equal(f.reads,1);
  f.now=40000+3600000;await f.service.read();assert.equal(f.reads,2);
});
test('Failed refresh retains the last good calendar and hides private upstream errors',async()=>{
  const f=fixture();f.fail=true;const result=await f.service.read(true);
  assert.equal(result.stale,true);assert.equal(result.events[0].id,'job');assert.equal(f.state,old);
  assert.ok(!result.error.includes('Private source unavailable'));
  await assert.rejects(f.service.connect('replacement'));assert.equal(f.state,old);
});
test('Deployment access fails closed outside explicitly protected Vercel hosts',()=>{
  const config={vercel:'1',nodeEnv:'production',protectionEnabled:'enabled',host:'warehouse-dashboard-dance-floors-guys.vercel.app'};
  assert.equal(warehouseAccessAllowed(config),true);
  for(const change of [{protectionEnabled:undefined},{vercel:undefined},{host:'public.example.com'},{host:'warehouse.vercel.app.evil.example'},{host:''}])assert.equal(warehouseAccessAllowed({...config,...change}),false);
  assert.equal(warehouseAccessAllowed({nodeEnv:'development',host:'localhost:3000'}),true);
  assert.equal(warehouseAccessAllowed({nodeEnv:'production',host:'localhost:3000'}),false);
});
test('Connection origin matches the browser-facing host behind a proxy',()=>{
  const config={origin:'https://warehouse.vercel.app',host:'warehouse.vercel.app',nodeEnv:'production'};
  assert.equal(warehouseOriginAllowed(config),true);
  for(const origin of [null,'null','https://evil.example','http://warehouse.vercel.app','https://warehouse.vercel.app/path'])assert.equal(warehouseOriginAllowed({...config,origin}),false);
  assert.equal(warehouseOriginAllowed({origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000',nodeEnv:'development'}),true);
});
