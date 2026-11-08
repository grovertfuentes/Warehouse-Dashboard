'use client';
import {useState} from 'react';
import {ArrowRight,LockKeyhole,Monitor} from 'lucide-react';
export default function LoginForm(){
  const [password,setPassword]=useState(''),[remember,setRemember]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function signIn(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,remember})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed.');
      setPassword('');const next=new URLSearchParams(window.location.search).get('next');window.location.replace(next==='/inventory'?'/inventory':'/');
    }catch(error){setError(error instanceof Error?error.message:'Unable to sign in. Please try again.');setBusy(false);}
  }
  return <main className="login-screen"><section className="login-card">
    <img className="login-logo" src="/brand/terg-logo.png" alt="The Event Rental Guys" width="1233" height="434"/>
    <div className="login-icon"><LockKeyhole size={24}/></div>
    <div className="eyebrow">WAREHOUSE OPERATIONS</div><h1>Your crew. Your calendar.</h1>
    <p className="login-intro">Enter the warehouse password to open the schedule.</p>
    <form onSubmit={signIn}>
      <label className="login-label" htmlFor="warehouse-password">Password</label>
      <input id="warehouse-password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoFocus/>
      <label className="remember-tv"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span><strong>Remember this warehouse TV</strong><small>Stay signed in through refreshes and restarts.</small></span><Monitor size={21}/></label>
      {error&&<div className="form-error" role="alert">{error}</div>}
      <button className="login-submit" disabled={busy||!password}>{busy?'Signing in…':'Open dashboard'}<ArrowRight size={18}/></button>
    </form><p className="login-footnote">Sign-in renews while the dashboard is in use.<br/>Remembered devices expire after 30 days without use.</p>
  </section></main>;
}
