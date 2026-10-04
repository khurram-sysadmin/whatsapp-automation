import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "./client";
import type { Row } from "./client";

export function AutomaticConnection({workspaceId,onRefresh,onClose}: {workspaceId:string;onRefresh:()=>Promise<void>;onClose:()=>void}) {
  const [pat,setPat]=useState(""), [sessions,setSessions]=useState<Row[]>([]), [selected,setSelected]=useState(""), [name,setName]=useState(""), [replace,setReplace]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState(""), [done,setDone]=useState<Row|null>(null);
  const requestId=useRef(crypto.randomUUID());
  const inFlight=useRef<AbortController|null>(null);
  useEffect(()=>()=>inFlight.current?.abort(),[]);
  useEffect(()=>{
    if(!pat||busy)return;
    const timer=setTimeout(()=>{setPat("");setSessions([]);setSelected("");setError("Your temporary token was cleared after inactivity. Enter it again to continue.");},600000);
    return()=>clearTimeout(timer);
  },[pat,busy]);
  const picked=sessions.find(s=>s.id===selected);
  const request=async(operation:string)=>{
    const session=(await supabase!.auth.getSession()).data.session;
    if(!session)throw Error("Please sign in again.");
    const controller=new AbortController();inFlight.current=controller;
    const response=await fetch('/connect/wasender.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({operation,workspaceId,personalAccessToken:pat,providerSessionId:selected,displayName:name,replaceWebhook:replace,requestId:requestId.current}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(150000)])});
    let result:Row;
    try {result=await response.json();}catch{throw Error("Connection setup is unavailable on this server. Contact support.");}
    if(!response.ok||!result.success)throw Error(result.error?.message||"Setup could not be confirmed. Refresh connections before retrying.");
    return result.data;
  };
  const perform=async(connect:boolean)=>{
    if(busy)return;setBusy(true);setError("");
    try{
      const data=await request(connect?'connect':'list');
      if(connect){setPat("");setSessions([]);setDone(data.connection);await onRefresh();}
      else {setSessions(data.sessions); if(!data.sessions.length)setError("No numbers found. Connect WhatsApp in WASender, then refresh this list.");}
    }catch(e){setError(e instanceof Error?e.message:"Unable to connect. Refresh before retrying.");}
    finally{setBusy(false);}
  };
  const close=()=>{setPat("");setSessions([]);onClose();};
  return <section className="v2-card v2-automatic-connection" aria-label="Automatic WhatsApp setup">
    <div className="v2-connection-header"><h3>{done?"Your WhatsApp is connected":"Connect WhatsApp in three steps"}</h3><button type="button" className="v2-connection-close" aria-label="Close WhatsApp setup" title="Close setup" disabled={busy} onClick={close}><X size={18} aria-hidden="true" /></button></div>
    {done ? <><p>{done.displayName} · {done.phoneE164}</p><p>Configuration saved. Delivery updates are awaiting a verified provider callback.</p><p className="v2-muted">Your account token has been cleared from this setup. You can revoke it in WASender. Billing remains with your own WASender account.</p><button type="button" onClick={onClose}>Done</button></> : <>
      <ol className="v2-guide"><li>Sign in to your own WASender account and choose your plan. Connect WhatsApp by scanning its QR code from WhatsApp → Linked devices.</li><li>Open WASender Settings → Personal Access Token. Create a token and paste it below.</li><li>Select your connected number. EightBit configures message updates automatically.</li></ol>
      <a className="v2-button" href="https://www.wasenderapi.com" target="_blank" rel="noreferrer">Open WASender</a>
      <label className="v2-field">Personal Access Token<input type="password" autoComplete="off" value={pat} disabled={busy} onChange={e=>{setPat(e.target.value);setSessions([]);setSelected("");setReplace(false);requestId.current=crypto.randomUUID();}} /></label>
      <p className="v2-muted">This token gives account-wide access. We use it temporarily to set up your selected number and do not save it. Only that number’s messaging key and webhook secret are kept encrypted. Your provider subscription stays on your account.</p>
      <button type="button" disabled={busy||pat.length<16} onClick={()=>void perform(false)}>{busy?"Checking…":"Find my WhatsApp numbers"}</button>
      {sessions.length>0&&<><label className="v2-field">Your WhatsApp number<select value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setName(sessions.find(s=>s.id===e.target.value)?.name||"");setReplace(false);requestId.current=crypto.randomUUID();}}><option value="">Choose a connected number</option>{sessions.map(s=><option key={s.id} value={s.id} disabled={s.status!=='connected'}>{s.name} · {s.phone} · {s.status}</option>)}</select></label><label className="v2-field">Connection name<input value={name} maxLength={200} disabled={busy} onChange={e=>{setName(e.target.value);requestId.current=crypto.randomUUID();}} /></label>
      {picked?.resumingSetup&&<p className="v2-notice">We found unfinished setup for this number in your company. Finish connecting it without creating another connection or replacing its webhook.</p>}
      {picked?.hasWebhook&&!picked?.resumingSetup&&<label className="v2-notice v2-checkbox-notice"><input type="checkbox" checked={replace} disabled={busy} onChange={e=>setReplace(e.target.checked)} /><span>This number already sends updates to another webhook. I approve replacing it for this company; its previous integration may stop receiving updates.</span></label>}
      <button type="button" className="v2-primary" disabled={busy||!selected||!name.trim()||Boolean(picked?.hasWebhook&&!picked?.resumingSetup&&!replace)} onClick={()=>void perform(true)}>{busy?"Connecting securely…":picked?.resumingSetup?"Finish connection":"Connect selected number"}</button></>}
      <button type="button" disabled={busy} onClick={close}>Cancel and clear token</button>
    </>}
    {error&&<p role="alert" className="v2-error">{error}</p>}
  </section>;
}
