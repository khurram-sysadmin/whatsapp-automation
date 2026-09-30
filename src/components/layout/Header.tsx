import React from 'react';
import { Menu, Plus, RefreshCw, Smartphone } from 'lucide-react';
import type { NavTab } from './Sidebar';
import type { AppSettings } from '../../types';

interface HeaderProps {
  activeTab: NavTab;
  onOpenMobile: () => void;
  onNewCampaign: () => void;
  settings: AppSettings;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Performance metrics and dispatch throughput.',
  },
  campaigns: {
    title: 'Campaigns',
    subtitle: 'Manage and launch outreach dispatches.',
  },
  contacts: {
    title: 'Contacts',
    subtitle: 'Target contact records and custom attributes.',
  },
  templates: {
    title: 'Templates',
    subtitle: 'WhatsApp templates with variable interpolation.',
  },
  messages: {
    title: 'Outbound Logs',
    subtitle: 'Dispatch delivery and status records.',
  },
  replies: {
    title: 'Inbox / Replies',
    subtitle: 'Incoming WhatsApp messages and conversation threads.',
  },
  suppression: {
    title: 'Suppression List',
    subtitle: 'Opted-out numbers bypassed by n8n workflows.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Campaign defaults, connection status, and account security.',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobile,
  onNewCampaign,
  settings,
  onRefreshData,
  isRefreshing = false,
}) => {
  const info = TAB_TITLES[activeTab] || { title: 'Outreach', subtitle: '' };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenMobile}
            aria-label="Open navigation"
            className="md:hidden p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">{info.title}</h2>
            <p className="text-xs text-zinc-500 font-normal">{info.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 self-end sm:self-auto">
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              title={isRefreshing ? 'Refreshing data...' : 'Refresh data'}
              className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all text-xs flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF5533]' : ''}`} />
              {isRefreshing && <span className="text-[11px] font-semibold text-zinc-500">Syncing...</span>}
            </button>
          )}

          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
            <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-zinc-700">{settings.whatsapp_phone || 'Outreach Console'}</span>
          </div>

          <button
            onClick={onNewCampaign}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF5533] hover:bg-[#E64422] text-white font-bold text-xs shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>
    </header>
  );
};
