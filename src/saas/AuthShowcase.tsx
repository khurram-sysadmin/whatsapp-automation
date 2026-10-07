import { ArrowRight, CheckCheck, MessageCircle, Send, Users } from "lucide-react";

/** Illustrative product story; never displays customer conversations or live counts. */
export function AuthShowcase() {
  return <div className="v2-auth-showcase">
    <div className="v2-auth-flow" aria-label="Contacts, campaigns and conversations">
      <span><Users size={15} /> Contacts</span><ArrowRight size={14} aria-hidden="true" />
      <span><Send size={15} /> Campaigns</span><ArrowRight size={14} aria-hidden="true" />
      <span><MessageCircle size={15} /> Conversations</span>
    </div>
    <section className="v2-auth-demo" aria-label="Illustrative conversation preview">
      <header><span className="v2-auth-demo-icon"><MessageCircle size={21} /></span><div><strong>A little hello. A new connection.</strong><small>From campaign to conversation</small></div><span className="v2-auth-demo-label">PREVIEW</span></header>
      <div className="v2-auth-demo-chat">
        <div className="v2-auth-chat-out">Hi Sarah! Your new collection is ready to explore.<span>Delivered <CheckCheck size={14} /></span></div>
        <div className="v2-auth-chat-in">Love it! Can you send me the details?<span>Reply received</span></div>
      </div>
      <footer><span><i /> Keep the conversation going</span><MessageCircle size={16} aria-hidden="true" /></footer>
    </section>
    <p className="v2-auth-showcase-caption">Create a campaign. Follow delivery. Reply in one inbox.</p>
  </div>;
}
