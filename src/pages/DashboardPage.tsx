import React, { useEffect } from 'react';
import {
  Send,
  Play,
  Users,
  Clock,
  CheckCircle2,
  Eye,
  MessageCircle,
  AlertTriangle,
  UserX,
  Plus,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';
import type { DashboardKPIs, Campaign } from '../types';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { Logger } from '../utils/logger';

interface DashboardPageProps {
  kpis: DashboardKPIs;
  recentCampaigns: Campaign[];
  onNavigateTab: (tab: any) => void;
  onSelectCampaign: (id: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  kpis,
  recentCampaigns,
  onNavigateTab,
  onSelectCampaign,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  useEffect(() => {
    if (isLoading) {
      Logger.dashboardLoading();
    } else {
      Logger.dashboardLoaded();
    }
  }, [isLoading]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const kpiCards = [
    { title: 'Total Campaigns', value: kpis.total_campaigns, icon: Send },
    { title: 'Active Campaigns', value: kpis.active_campaigns, icon: Play },
    { title: 'Total Contacts', value: kpis.total_contacts, icon: Users },
    { title: 'Queued Messages', value: kpis.queued_messages, icon: Clock },
    { title: 'Sent Messages', value: kpis.sent_messages, icon: Send },
    { title: 'Delivered', value: kpis.delivered_messages, icon: CheckCircle2 },
    { title: 'Read', value: kpis.read_messages, icon: Eye },
    { title: 'Replied', value: kpis.replied_messages, icon: MessageCircle },
    { title: 'Failed', value: kpis.failed_messages, icon: AlertTriangle },
    { title: 'Opted Out', value: kpis.opted_out_contacts, icon: UserX },
  ];

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
      {/* 10 KPI Cards Grid - Clean Monochrome & Accent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Overview Metrics
          </h3>
          <span className="text-[11px] font-semibold text-zinc-400">Sync Active</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {kpiCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl p-3.5 border border-zinc-200 shadow-subtle hover:border-zinc-300 transition-all"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                  <span className="text-xs font-medium text-zinc-500 truncate">{card.title}</span>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <p className="text-lg font-bold text-zinc-900 tracking-tight">
                  {card.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaigns Section */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-subtle overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Recent Campaigns</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live status and dispatch progress
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('campaigns')}
            className="flex items-center space-x-1 text-xs font-bold text-[#FF5533] hover:underline"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xs font-semibold text-zinc-500 mb-3">No campaigns created yet.</p>
            <button
              onClick={() => onNavigateTab('campaigns')}
              className="px-4 py-2 bg-[#FF5533] text-white font-bold text-xs rounded-lg shadow-xs inline-flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Campaign</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                <tr>
                  <th className="px-5 py-3">Campaign Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Sent / Total</th>
                  <th className="px-5 py-3">Replied</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentCampaigns.map(cmp => {
                  const pct = cmp.total_contacts > 0
                    ? Math.round((cmp.sent_count / cmp.total_contacts) * 100)
                    : 0;
                  return (
                    <tr key={cmp.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-zinc-900">{cmp.name}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {cmp.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 w-40">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#FF5533] h-full rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-bold text-[11px] text-zinc-700">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium">
                        {cmp.sent_count} / {cmp.total_contacts}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-zinc-900">
                        {cmp.replied_count}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => onSelectCampaign(cmp.id)}
                          className="px-2.5 py-1 rounded bg-zinc-900 text-white font-semibold text-xs hover:bg-[#FF5533] transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
