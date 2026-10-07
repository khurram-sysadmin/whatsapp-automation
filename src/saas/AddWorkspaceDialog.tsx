import { useRef, useState } from 'react';
import { Building2, X } from 'lucide-react';
import { action } from './client';
import { TIME_ZONES, timeZoneLabel } from '../utils/timezones';
import { useDialogFocus } from './dialogFocus';

export function AddWorkspaceDialog({initialTimezone,onClose,onCreated,createWorkspace=(companyName,timezone)=>action('workspaceCreate',undefined,{companyName,timezone})}:{initialTimezone:string;onClose:()=>void;onCreated:(id:string)=>Promise<void>;createWorkspace?:(companyName:string,timezone:string)=>Promise<{workspaceId:string}>}) {
  const [name,setName]=useState(''),[timezone,setTimezone]=useState(initialTimezone),[busy,setBusy]=useState(false),[error,setError]=useState(''),[createdId,setCreatedId]=useState('');
  const pending=useRef(false);
  useDialogFocus(true,onClose,busy);
  return <div className="v2-overlay"><section className="v2-card v2-dialog v2-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="add-workspace-title">
    <div className="v2-connection-header"><div><span className="v2-workspace-symbol"><Building2 size={22}/></span><h2 id="add-workspace-title">Add workspace</h2><p className="v2-muted">Create a separate space for another company or brand.</p></div><button type="button" className="v2-icon-button" aria-label="Close add workspace" disabled={busy} onClick={onClose}><X size={18}/></button></div>
    <form onSubmit={async event=>{
      event.preventDefault();
      if(pending.current)return;
      if(!name.trim()){setError('Enter a workspace name.');return;}
      pending.current=true;setBusy(true);setError('');
      try{
        let id=createdId;
        if(!id){const created=await createWorkspace(name.trim(),timezone);id=created.workspaceId;setCreatedId(id);}
        await onCreated(id);
      }catch(reason){setError(reason instanceof Error?reason.message:'Unable to create your workspace. Please try again.');}
      finally{pending.current=false;setBusy(false);}
    }}>
      <label className="v2-field">Workspace name<input name="companyName" value={name} onChange={event=>setName(event.target.value)} maxLength={200} required disabled={busy || !!createdId} placeholder="e.g. Acme Solutions" autoComplete="organization"/></label>
      <label className="v2-field">Timezone<select name="timezone" value={timezone} onChange={event=>setTimezone(event.target.value)} required disabled={busy || !!createdId}>{TIME_ZONES.map(zone=><option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}</select></label>
      <p className="v2-workspace-note">Contacts, campaigns and WhatsApp connections stay separate in each workspace.</p>
      {createdId&&error&&<p className="v2-muted">Your workspace was created. Retry opening it; this won’t create another workspace.</p>}
      {error&&<p className="v2-error" role="alert">{error}</p>}
      <div className="v2-actions v2-workspace-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="v2-primary" disabled={busy}>{busy?'Please wait…':createdId?'Open workspace':'Create workspace'}</button></div>
    </form>
  </section></div>;
}
