'use client';
import {useEffect,useState} from 'react';
import {LogOut} from 'lucide-react';
export function SessionKeepAlive(){
  useEffect(()=>{
    let running=false,stopped=false;
    async function renew(){
      if(running||stopped)return;running=true;
      try{const response=await fetch('/api/auth/session',{method:'POST',cache:'no-store'});if(response.status===401&&!stopped)window.location.replace('/login?next='+encodeURIComponent(window.location.pathname));}catch{/* A network interruption must not blank the warehouse schedule. */}finally{running=false;}
    }
    const visible=()=>{if(document.visibilityState==='visible')void renew();};
    void renew();const timer=setInterval(()=>void renew(),15*60*1000);
    window.addEventListener('pageshow',renew);window.addEventListener('online',renew);window.addEventListener('focus',renew);document.addEventListener('visibilitychange',visible);
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener('pageshow',renew);window.removeEventListener('online',renew);window.removeEventListener('focus',renew);document.removeEventListener('visibilitychange',visible);};
  },[]);
  return null;
}
export function SignOutButton(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  async function signOut(){setBusy(true);setError(false);try{const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok)throw new Error();window.location.replace('/login');}catch{setError(true);setBusy(false);}}
  return <button className="icon-button" title={error?'Sign out failed. Click to retry.':'Sign out'} aria-label={error?'Retry sign out':'Sign out'} disabled={busy} onClick={signOut}><LogOut size={18}/></button>;
}
