import { formatDate } from '../services/normalize';
import { lower } from '../services/normalize';
import React, { useState } from 'react';
import {
  Search,
  Send,
  ShieldAlert,
  CheckCheck
} from 'lucide-react';
import type { ConversationReply } from '../types';
import { useToast } from '../components/ui/Toast';

interface RepliesPageProps {
  replies: ConversationReply[];
  onSendReply: (conversationId: string, text: string) => Promise<void>;
  onAddToSuppression: (phone: string, name: string) => Promise<void>;
}

export const RepliesPage: React.FC<RepliesPageProps> = ({
  replies,
  onSendReply,
  onAddToSuppression,
}) => {
  const { showSuccess,showError } = useToast();
  const [selectedId, setSelectedId] = useState<string>(replies[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyInput, setReplyInput] = useState('');

  const activeConv = (replies || []).find(r => r && r.id === selectedId) || (replies && replies[0]);

  const filtered = (replies || []).filter(r => {
    if (!r) return false;
    const name = lower(r.contact_name);
    const company = lower(r.company);
    const phone = lower(r.phone);
    const lastMsg = lower(r.last_message);
    const search = lower(searchTerm);

    return (
      name.includes(search) ||
      company.includes(search) ||
      phone.includes(search) ||
      lastMsg.includes(search)
    );
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeConv) return;

    try{await onSendReply(activeConv.id, replyInput.trim());
    showSuccess('Reply Sent', `Dispatched WhatsApp reply to ${activeConv.contact_name}.`);
    setReplyInput('');}catch(e){showError('Reply Not Sent',e instanceof Error?e.message:'Please retry.');}
  };

  const handleBlockContact = async () => {
    if (!activeConv) return;
    if (window.confirm(`Add ${activeConv.contact_name} (${activeConv.phone}) to Suppression List?`)) {
      try{await onAddToSuppression(activeConv.phone, activeConv.contact_name);
      showSuccess('Opted Out', `${activeConv.contact_name} added to Suppression List.`);}catch(e){showError('Suppression Failed',e instanceof Error?e.message:'Please retry.');}
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-subtle overflow-hidden h-[calc(100vh-12rem)] flex flex-col md:flex-row">
      <div className="w-full md:w-80 border-r border-zinc-200/80 flex flex-col bg-[#F5F4F2]/30">
        <div className="p-4 border-b border-zinc-200/80">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {filtered.map(conv => {
            const isSelected = conv.id === activeConv?.id;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-white border-l-4 border-l-[#FF5533] shadow-xs'
                    : 'hover:bg-zinc-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-xs text-[#09090B] truncate">
                    {conv.contact_name}
                  </h4>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-[11px] font-semibold text-[#FF5533] mb-1">
                  {conv.company}
                </p>

                <p className="text-xs text-zinc-500 truncate leading-snug">
                  {conv.last_message}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {activeConv ? (
        <div className="flex-1 flex flex-col bg-[#E5DDD5]/20">
          <div className="p-4 bg-white border-b border-zinc-200/80 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#09090B] text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                {activeConv.contact_name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#09090B]">{activeConv.contact_name}</h3>
                <p className="text-xs text-zinc-500">
                  {activeConv.company} • <span className="font-mono">{activeConv.phone}</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleBlockContact}
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center space-x-1.5 transition-colors"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Suppress Number</span>
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-zinc-50/50">
            {activeConv.messages.map(m => {
              const isAgent = m.sender === 'agent';
              return (
                <div
                  key={m.id}
                  className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                      isAgent
                        ? 'bg-[#DCF8C6] text-[#09090B] rounded-tr-none border border-emerald-200/60'
                        : 'bg-white text-[#09090B] rounded-tl-none border border-zinc-200/80'
                    }`}
                  >
                    <p>{m.text}</p>
                    <div
                      className={`text-[9px] mt-1 font-mono text-right flex items-center justify-end space-x-1 ${
                        isAgent ? 'text-emerald-800' : 'text-zinc-400'
                      }`}
                    >
                      <span>{formatDate(m.timestamp,'time')}</span>
                      {isAgent && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSend} className="p-4 bg-white border-t border-zinc-200 flex items-center space-x-3">
            <input
              type="text"
              value={replyInput}
              onChange={e => setReplyInput(e.target.value)}
              disabled
              placeholder="Incoming replies — reply sending is unavailable"
              className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533] focus:bg-white text-[#09090B]"
            />
            <button
              disabled
              type="submit"
              className="px-5 py-3 bg-[#FF5533] hover:bg-[#E64422] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5533]/20 flex items-center space-x-1.5 transition-all"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs">
          No conversation selected.
        </div>
      )}
    </div>
  );
};
