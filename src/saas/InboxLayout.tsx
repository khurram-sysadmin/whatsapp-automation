import { useState, type ReactNode } from 'react';
import { Search, MessageSquare, ArrowLeft, Phone, Mail, Building2, MapPin, Briefcase, Smartphone } from 'lucide-react';
import type { Row } from './client';

export function contactName(contact?: Row) {
  return String(contact?.name || contact?.firstName || contact?.phoneE164 || 'Contact');
}
export function ContactAvatar({name,large=false}:{name:string;large?:boolean}) {
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const tone=[...name].reduce((sum,char)=>sum+char.charCodeAt(0),0)%4;
  return <span aria-hidden="true" className={`v2-contact-avatar tone-${tone}${large?' large':''}`}>{initials || '?'}</span>;
}
function messageTime(value:unknown) {
  if(!value)return '';
  const time=new Date(String(value));
  if(Number.isNaN(time.getTime()))return '';
  return time.toLocaleDateString()===new Date().toLocaleDateString()?time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):time.toLocaleDateString([],{month:'short',day:'numeric'});
}
export function InboxLayout({items,selectedId,conversation,connectionName,onSelect,onBack,children}:{items:Row[];selectedId:string;conversation:Row|null;connectionName:string;onSelect:(item:Row)=>void;onBack:()=>void;children:ReactNode}) {
  const [search,setSearch]=useState('');
  const selected=conversation || items.find(item=>item.conversationId===selectedId);
  const contact=selected?.contact;
  const matches=items.filter(item=>[contactName(item.contact),item.contact?.company,item.contact?.phoneE164,item.contact?.email,item.lastMessage].some(value=>String(value||'').toLowerCase().includes(search.trim().toLowerCase())));
  return <div className={`v2-inbox v2-inbox-workspace${selectedId?' has-conversation':''}`}>
    <section className="v2-card v2-inbox-list" aria-label="Conversations">
      <div className="v2-inbox-list-heading"><h2>Conversations</h2><span>{items.length}</span></div>
      <label className="v2-inbox-search"><Search size={16}/><input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={event=>setSearch(event.target.value)}/></label>
      <div className="v2-inbox-list-scroll">
        {matches.map(item=><button key={item.conversationId} className={'v2-conversation v2-chat-contact'+(item.conversationId===selectedId?' selected':'')} aria-pressed={item.conversationId===selectedId} onClick={()=>onSelect(item)}>
          <ContactAvatar name={contactName(item.contact)}/><span className="v2-chat-contact-copy"><span className="v2-chat-contact-title"><strong>{contactName(item.contact)}</strong><time>{messageTime(item.lastMessageAt)}</time></span><span className="v2-chat-contact-preview">{item.lastMessage || item.contact?.company || item.contact?.phoneE164 || 'Open conversation'}</span></span>
          {Number(item.unreadCount)>0&&<b className="v2-chat-unread" aria-label={`${item.unreadCount} unread messages`}>{Math.min(99,Number(item.unreadCount))}</b>}
        </button>)}
        {!matches.length&&<div className="v2-inbox-empty"><MessageSquare size={26}/><strong>{search?'No matching conversations':'No conversations yet'}</strong><p>{search?'Try a name, company or phone number.':'Customer replies will appear here.'}</p></div>}
      </div>
    </section>
    <section className="v2-card v2-inbox-chat" aria-label="Conversation">
      {selectedId&&<header className="v2-chat-heading"><button className="v2-icon-button v2-inbox-back" type="button" aria-label="Back to conversations" onClick={onBack}><ArrowLeft size={18}/></button><ContactAvatar name={contactName(contact)}/><div><h2>{contactName(contact)}</h2><p>{contact?.company || contact?.phoneE164 || 'WhatsApp conversation'}</p></div><span className="v2-channel-label"><Smartphone size={14}/>WhatsApp</span></header>}
      <div className="v2-chat-body">{children}</div>
    </section>
    {selectedId&&<aside className="v2-card v2-inbox-profile"><details open><summary>Contact profile</summary><div className="v2-profile-identity"><ContactAvatar name={contactName(contact)} large/><h3>{contactName(contact)}</h3>{contact?.company&&<p>{contact.company}</p>}</div><dl>{[[Phone,'Phone',contact?.phoneE164],[Mail,'Email',contact?.email],[Building2,'Company',contact?.company],[MapPin,'City',contact?.city],[Briefcase,'Industry',contact?.industry],[Smartphone,'Connection',connectionName]].map(([Icon,title,value])=>{const FieldIcon=Icon as typeof Phone;return <div key={String(title)}><dt><FieldIcon size={14}/>{String(title)}</dt><dd>{String(value || '—')}</dd></div>;})}</dl></details></aside>}
  </div>;
}
