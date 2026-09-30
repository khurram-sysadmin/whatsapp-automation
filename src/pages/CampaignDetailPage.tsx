import { formatDate } from '../services/normalize';
import { lower } from '../services/normalize';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Square,
  Clock,
  Send,
  CheckCircle2,
  Eye,
  MessageCircle,
  AlertTriangle,
  UserX,
  Users,
  Search
} from 'lucide-react';
import type { Campaign, OutboundMessage } from '../types';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ApiService, isValidUUID } from '../services/api';



interface CampaignDetailPageProps {
  campaign: Campaign;
  messages: OutboundMessage[];
  onBack: () => void;
  onDelete: (id:string)=>Promise<void>;
  onUpdateStatus: (campaignId: string, actionOrStatus: any) => Promise<void> | void;
}

export const CampaignDetailPage: React.FC<CampaignDetailPageProps> = ({
  campaign,
  messages,
  onBack,
  onDelete,
  onUpdateStatus,
}) => {
  const { showSuccess, showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmModalAction, setConfirmModalAction] = useState<string | null>(null);
  const [liveCampaign, setLiveCampaign] = useState<Campaign>(campaign);
  const [liveMessages, setLiveMessages] = useState<OutboundMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const alive=useRef(true),lock=useRef(false),statusRef=useRef(campaign.status),loadVersion=useRef(0);
  const [actionBusy,setActionBusy]=useState(false);
  const loadCampaignData = useCallback(async () => {
    if(!isValidUUID(campaign.id)||!alive.current)return;
    const version=++loadVersion.current;
    setIsLoading(true);
    const results=await Promise.allSettled([ApiService.fetchCampaignById(campaign.id),ApiService.fetchMessages(campaign.id,100,0)]);
    if(!alive.current||version!==loadVersion.current)return;
    const errors:string[]=[];
    if(results[0].status==='fulfilled'){setLiveCampaign(results[0].value);statusRef.current=results[0].value.status;}else errors.push(results[0].reason instanceof Error?results[0].reason.message:'Campaign refresh failed.');
    if(results[1].status==='fulfilled')setLiveMessages(results[1].value);else errors.push(results[1].reason instanceof Error?results[1].reason.message:'Message refresh failed.');
    setFetchError(errors.length?errors.join(' '):null);setIsLoading(false);
  },[campaign.id]);
  useEffect(()=>{
    alive.current=true;statusRef.current=campaign.status;++loadVersion.current;setLiveCampaign(campaign);setLiveMessages([]);
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(cancelled)return;if(document.visibilityState==='visible'&&!lock.current)await loadCampaignData();if(!cancelled)timer=setTimeout(poll,['running','paused'].includes(statusRef.current)?5000:15000);};
    void poll();return ()=>{cancelled=true;alive.current=false;clearTimeout(timer);};
  },[campaign.id,loadCampaignData]);
  useEffect(()=>{
    // Completed is terminal; an older list response must not restore its controls.
    if(statusRef.current==='completed' && campaign.status!=='completed')return;
    setLiveCampaign(campaign);statusRef.current=campaign.status;
  },[campaign]);

  const activeCmp = liveCampaign || campaign;

  const pct = activeCmp.status === 'completed' ? 100 : activeCmp.total_contacts > 0
    ? Math.min(100,Math.round((activeCmp.sent_count / activeCmp.total_contacts) * 100))
    : 0;

  const handleActionTrigger = (actionName: string) => {
    setConfirmModalAction(actionName);
  };

  const handleConfirmStatusChange = async () => {
    if(!confirmModalAction||lock.current)return;
    lock.current=true;++loadVersion.current;setActionBusy(true);
    try{if(confirmModalAction==='delete'){alive.current=false;try{await onDelete(campaign.id);}catch(e){alive.current=true;throw e;}}else{await onUpdateStatus(campaign.id,confirmModalAction);showSuccess('Campaign Updated',`Action "${confirmModalAction}" succeeded.`);await loadCampaignData();}setConfirmModalAction(null);}
    catch(e){showError('Action Failed',e instanceof Error?e.message:'Please retry.');}
    finally{lock.current=false;setActionBusy(false);setIsLoading(false);}
  };

  const currentMessages = !isLoading || liveMessages.length > 0
    ? liveMessages
    : messages.filter(m => m.campaign_id === campaign.id || m.campaign_name === campaign.name);

  const filteredMessages = currentMessages.filter(m => {
    const matchesSearch =
      lower(m.contact_name).includes(lower(searchTerm)) ||
      lower(m.company).includes(lower(searchTerm)) ||
      m.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={loadCampaignData}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center space-x-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry Sync</span>
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-subtle">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#09090B] break-words">{activeCmp.name}</h2>
              <Badge status={activeCmp.status} size="md" />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              UUID: <span className="font-mono break-all">{activeCmp.id}</span> • Template: <strong>{activeCmp.template_name}</strong> • Created{' '}
              {activeCmp.created_at && Number.isFinite(Date.parse(activeCmp.created_at)) ? formatDate(activeCmp.created_at,'full') : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeCmp.status === 'draft' && (
            <button
              disabled={actionBusy || activeCmp.total_contacts===0}
              onClick={() => handleActionTrigger('start')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Start</span>
            </button>
          )}

          {activeCmp.status === 'running' && (
            <button
              disabled={actionBusy}
              onClick={() => handleActionTrigger('pause')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            >
              <Pause className="w-3.5 h-3.5 fill-white" />
              <span>Pause</span>
            </button>
          )}

          {activeCmp.status === 'paused' && (
            <button
              disabled={actionBusy}
              onClick={() => handleActionTrigger('resume')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          )}

          {['running','paused'].includes(activeCmp.status) && (
            <button
              disabled={actionBusy}
              onClick={() => handleActionTrigger('stop')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop</span>
            </button>
          )}
          {['draft','paused','stopped','completed'].includes(activeCmp.status) && <button disabled={actionBusy} onClick={()=>handleActionTrigger('delete')} className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold">Delete Campaign</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-subtle">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
            Execution Progress
          </span>
          <span className="text-lg font-extrabold text-[#09090B]">{pct}% Completed</span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden border border-zinc-200/80">
          <div
            className="bg-[#FF5533] h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500 mt-3">
          <span>{activeCmp.sent_count} sent out of {activeCmp.total_contacts} total contacts</span>
          <span>Interval: {activeCmp.sending_interval}s • Window: {activeCmp.start_time} - {activeCmp.end_time} ({activeCmp.timezone || 'Asia/Karachi'})</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-subtle">
          <div className="flex items-center text-zinc-500 text-xs font-semibold mb-1">
            <Users className="w-3.5 h-3.5 mr-1" /> Total Contacts
          </div>
          <p className="text-lg font-bold text-[#09090B]">{activeCmp.total_contacts}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-subtle">
          <div className="flex items-center text-amber-700 text-xs font-semibold mb-1">
            <Clock className="w-3.5 h-3.5 mr-1" /> Queued
          </div>
          <p className="text-lg font-bold text-amber-700">{activeCmp.queued_count}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#FF5533]/30 bg-[#FF5533]/5 shadow-subtle">
          <div className="flex items-center text-[#FF5533] text-xs font-semibold mb-1">
            <Send className="w-3.5 h-3.5 mr-1" /> Sent
          </div>
          <p className="text-lg font-bold text-[#FF5533]">{activeCmp.sent_count}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-subtle">
          <div className="flex items-center text-emerald-700 text-xs font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Delivered
          </div>
          <p className="text-lg font-bold text-emerald-700">{activeCmp.delivered_count}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-sky-200 bg-sky-50/20 shadow-subtle">
          <div className="flex items-center text-sky-700 text-xs font-semibold mb-1">
            <Eye className="w-3.5 h-3.5 mr-1" /> Read
          </div>
          <p className="text-lg font-bold text-sky-700">{activeCmp.read_count}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-subtle">
          <div className="flex items-center text-indigo-700 text-xs font-semibold mb-1">
            <MessageCircle className="w-3.5 h-3.5 mr-1" /> Replied
          </div>
          <p className="text-lg font-bold text-indigo-700">{activeCmp.replied_count}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-subtle">
          <div className="flex items-center text-rose-700 text-xs font-semibold mb-1">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Failed
          </div>
          <p className="text-lg font-bold text-rose-700">{activeCmp.failed_count}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 bg-slate-50/20 shadow-subtle">
          <div className="flex items-center text-slate-700 text-xs font-semibold mb-1">
            <UserX className="w-3.5 h-3.5 mr-1" /> Opted Out
          </div>
          <p className="text-lg font-bold text-slate-700">{activeCmp.opted_out_count}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-subtle overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#09090B]">Campaign Dispatch Logs</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live status feed for every recipient in this campaign callset.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search contact or phone..."
                className="w-full min-w-0 pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533]"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="replied">Replied</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-[#F5F4F2]/70 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3.5">Contact</th>
                <th className="px-6 py-3.5">Phone</th>
                <th className="px-6 py-3.5">Company</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Sent Time</th>
                <th className="px-6 py-3.5">Read Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-zinc-400">
                    No dispatch messages recorded yet for this campaign.
                  </td>
                </tr>
              ) : (
                filteredMessages.map(msg => (
                  <tr key={msg.id} className="hover:bg-zinc-50/80">
                    <td className="px-6 py-4 font-bold text-[#09090B]">{msg.contact_name}</td>
                    <td className="px-6 py-4 font-mono text-zinc-700">{msg.phone}</td>
                    <td className="px-6 py-4 text-zinc-600">{msg.company || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge status={msg.status} />
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {msg.sent_at ? formatDate(msg.sent_at,'time') : '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {msg.read_at ? formatDate(msg.read_at,'time') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={confirmModalAction !== null}
        onClose={()=>{if(!lock.current)setConfirmModalAction(null);}}
        title={confirmModalAction==='delete' ? `Delete "${campaign.name}"?` : `Confirm Campaign ${confirmModalAction?.toUpperCase()}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-600">{confirmModalAction==='delete'?'This action cannot be undone.':`Confirm ${confirmModalAction} for "${campaign.name}"?`}</p>
          <div className="flex justify-end space-x-3 pt-2 border-t border-zinc-100">
            <button
              disabled={actionBusy}
              onClick={() => setConfirmModalAction(null)}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              disabled={actionBusy}
              onClick={handleConfirmStatusChange}
              className="px-4 py-2 rounded-xl bg-[#09090B] text-white text-xs font-bold hover:bg-[#FF5533]"
            >
              {actionBusy?'Working…':confirmModalAction==='delete'?'Delete Campaign':'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
