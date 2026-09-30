import { lower } from '../services/normalize';
import React, { useState } from 'react';
import {
  Plus,
  Search,
  Send,
  ChevronRight,
  Calendar,
  Clock
} from 'lucide-react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import type { Campaign } from '../types';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { CampaignsListSkeleton } from '../components/ui/LoadingSkeleton';

interface CampaignsPageProps {
  campaigns: Campaign[];
  onOpenWizard: () => void;
  onSelectCampaign: (id: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  campaigns,
  onOpenWizard,
  onSelectCampaign,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (isLoading) {
    return <CampaignsListSkeleton />;
  }

  const filtered = campaigns.filter(cmp => {
    const matchesSearch =
      lower(cmp.name).includes(lower(searchTerm)) ||
      lower(cmp.template_name).includes(lower(searchTerm));
    const matchesStatus = statusFilter === 'all' || cmp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Sync</span>
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-subtle">
        <div className="flex items-center space-x-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search campaigns or templates..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5533] focus:bg-white text-[#09090B]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="draft">Draft</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>

        <button
          onClick={onOpenWizard}
          className="px-5 py-2.5 bg-[#FF5533] hover:bg-[#E64422] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5533]/20 flex items-center justify-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No campaigns found"
          description="Create your first automated WhatsApp outreach sequence to start delivering personalized messages."
          icon={<Send className="w-7 h-7 text-[#FF5533]" />}
          actionButton={
            <button
              onClick={onOpenWizard}
              className="px-4 py-2 bg-[#FF5533] text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Create Campaign
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map(cmp => {
            const pct = cmp.total_contacts > 0
              ? Math.round((cmp.sent_count / cmp.total_contacts) * 100)
              : 0;

            return (
              <div
                key={cmp.id}
                onClick={() => onSelectCampaign(cmp.id)}
                className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-subtle hover:shadow-card hover:border-zinc-300 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-extrabold text-base text-[#09090B] group-hover:text-[#FF5533] transition-colors">
                        {cmp.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Template: <strong className="text-zinc-700">{cmp.template_name}</strong>
                      </p>
                    </div>
                    <Badge status={cmp.status} />
                  </div>

                  <div className="my-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-zinc-600">Completion</span>
                      <span className="font-bold text-[#09090B]">{pct}% ({cmp.sent_count}/{cmp.total_contacts})</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200/60">
                      <div
                        className="bg-[#FF5533] h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] my-3">
                    <div className="p-2 bg-amber-50/60 rounded-lg border border-amber-200/60">
                      <span className="text-amber-700 font-bold block">{cmp.queued_count}</span>
                      <span className="text-zinc-500 text-[10px]">Queued</span>
                    </div>
                    <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-200/60">
                      <span className="text-emerald-700 font-bold block">{cmp.delivered_count}</span>
                      <span className="text-zinc-500 text-[10px]">Delivered</span>
                    </div>
                    <div className="p-2 bg-indigo-50/60 rounded-lg border border-indigo-200/60">
                      <span className="text-indigo-700 font-bold block">{cmp.replied_count}</span>
                      <span className="text-zinc-500 text-[10px]">Replied</span>
                    </div>
                    <div className="p-2 bg-rose-50/60 rounded-lg border border-rose-200/60">
                      <span className="text-rose-700 font-bold block">{cmp.failed_count}</span>
                      <span className="text-zinc-500 text-[10px]">Failed</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-zinc-400" /> {cmp.sending_interval}s interval
                    </span>
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-zinc-400" /> {cmp.start_time}-{cmp.end_time}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-[#FF5533] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
