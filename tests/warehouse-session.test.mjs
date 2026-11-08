import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {authConfigured,passwordMatches,createWarehouseSession,readWarehouseSession,loginAttemptDecision,loginClientKey,SESSION_SECONDS} from '../lib/warehouse-session.mjs';
const salt='a'.repeat(32),password='warehouse-test-password';
const config={secret:'test-session-secret-'.repeat(4),passwordHash:salt+':'+scryptSync(password,salt,64).toString('hex'),scope:'production'};
test('Only the configured password is accepted; missing or malformed configuration fails closed',async()=>{
  assert.equal(await passwordMatches(password,config),true);
  for(const candidate of ['incorrect',password+' ',null,{},'x'.repeat(129)])assert.equal(await passwordMatches(candidate,config),false);
  for(const change of [{secret:''},{secret:'short'},{passwordHash:''},{passwordHash:'malformed'}]){
    assert.equal(authConfigured({...config,...change}),false);
    assert.equal(await passwordMatches(password,{...config,...change}),false);
    assert.equal(await readWarehouseSession('token',{...config,...change}),null);
  }
});
test('Remembered sessions survive fresh requests and reject tampering, expiry, or a different environment',async()=>{
  const now=Date.now(),token=await createWarehouseSession(true,config,now);
  assert.equal((await readWarehouseSession(token,config,now+86400000)).remember,true);
  assert.equal(await readWarehouseSession(token,config,now+SESSION_SECONDS*1000),null);
  assert.equal(await readWarehouseSession(token,{...config,scope:'preview'},now),null);
  assert.equal(await readWarehouseSession(token,{...config,secret:'different-secret-'.repeat(4)},now),null);
  assert.equal(await readWarehouseSession(token.slice(0,80)+'x'+token.slice(81),config,now),null);
  assert.equal(await readWarehouseSession('',config),null);
});
test('Active TVs renew their 30-day window; changing the password invalidates previous sessions',async()=>{
  const now=Date.now(),token=await createWarehouseSession(true,config,now);
  const current=await readWarehouseSession(token,config,now+20*86400000);
  const renewed=await createWarehouseSession(current.remember,config,now+20*86400000);
  assert.equal(await readWarehouseSession(token,config,now+40*86400000),null);
  assert.equal((await readWarehouseSession(renewed,config,now+40*86400000)).authenticated,true);
  const changed={...config,passwordHash:salt+':'+scryptSync('changed-test-password',salt,64).toString('hex')};
  assert.equal(await readWarehouseSession(token,changed,now),null);
  assert.equal((await readWarehouseSession(await createWarehouseSession(false,config),config)).remember,false);
});
test('Login attempt limits apply per client and across clients, then expire',()=>{
  const now=Date.now(),key=loginClientKey('test-client',config.secret);let attempts=[];
  assert.ok(!key.includes('test-client'));
  for(let i=0;i<5;i++){const result=loginAttemptDecision(attempts,key,now+i);assert.equal(result.allowed,true);attempts=result.attempts;}
  assert.equal(loginAttemptDecision(attempts,key,now+6).allowed,false);
  assert.ok(loginAttemptDecision(attempts,key,now+6).retryAfter>0);
  assert.equal(loginAttemptDecision(attempts,key,now+15*60000+5).allowed,true);
  attempts=Array.from({length:20},(_,i)=>({key:'client-'+i,time:now}));
  assert.equal(loginAttemptDecision(attempts,'new-client',now+1).allowed,false);
  assert.equal(loginAttemptDecision(attempts,'new-client',now+3600001).allowed,true);
});
