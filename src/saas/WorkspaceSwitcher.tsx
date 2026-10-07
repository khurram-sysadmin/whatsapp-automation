import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Plus} from 'lucide-react';
import type {Row} from './client';

export function WorkspaceSwitcher({workspaces,value,disabled=false,onSelect,onAdd}:{workspaces:Row[];value:string;disabled?:boolean;onSelect:(id:string)=>void;onAdd:()=>void}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
  const id=useId();
  const selected=workspaces.find(w=>w.workspaceId===value);
  const name=String(selected?.companyName || 'Choose workspace');
  const initials=(text:string)=>text.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  const close=(restore=false)=>{setOpen(false);if(restore)trigger.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    const buttons=menu.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]');
    const index=Math.max(0,workspaces.findIndex(w=>w.workspaceId===value));
    buttons?.[index]?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open,value,workspaces]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  return <div className="v2-workspace-switcher" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <span className="v2-workspace-label" id={id+'-label'}>Company</span>
    <button ref={trigger} type="button" className={'v2-workspace-trigger'+(open?' is-open':'')} aria-labelledby={id+'-label '+id+'-name'} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}}>
      <span className="v2-workspace-avatar" aria-hidden="true">{initials(name)}</span><span id={id+'-name'} className="v2-workspace-name">{name}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open&&<div ref={menu} id={id} role="menu" aria-labelledby={id+'-label'} className="v2-workspace-menu" onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')||[]);
      const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      buttons[next]?.focus();
    }}>
      <div className="v2-workspace-menu-heading">Your workspaces</div>
      <div className="v2-workspace-menu-list">{workspaces.map(w=><button type="button" key={w.workspaceId} role="menuitemradio" aria-checked={w.workspaceId===value} className={'v2-workspace-option'+(w.workspaceId===value?' selected':'')} onClick={()=>{close(true);if(w.workspaceId!==value)onSelect(w.workspaceId);}}>
        <span className="v2-workspace-avatar" aria-hidden="true">{initials(String(w.companyName))}</span><span className="v2-workspace-name">{w.companyName}</span>{w.workspaceId===value&&<Check size={16} aria-hidden="true"/>}
      </button>)}</div>
      <div className="v2-workspace-menu-footer"><button type="button" role="menuitem" className="v2-workspace-create" onClick={()=>{close(true);onAdd();}}><Plus size={17} aria-hidden="true"/> Add workspace</button></div>
    </div>}
  </div>;
}
