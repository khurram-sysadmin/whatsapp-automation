import React from 'react';
import {
  LayoutDashboard,
  Send,
  Users,
  FileText,
  MessageSquareText,
  MessageCircle,
  ShieldAlert,
  Settings as SettingsIcon,
  LogOut,
  X
} from 'lucide-react';
import type { AppSettings } from '../../types';
import { EightbitLogo } from '../ui/Logo';

export type NavTab =
  | 'dashboard'
  | 'campaigns'
  | 'contacts'
  | 'replies'
  | 'templates'
  | 'suppression'
  | 'messages'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCount: number;
  settings: AppSettings;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  unreadCount,
  settings,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const sections = [
    {
      title: 'OUTREACH',
      items: [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'campaigns' as NavTab, label: 'Campaigns', icon: Send },
        {
          id: 'replies' as NavTab,
          label: 'Replies / Inbox',
          icon: MessageCircle,
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { id: 'contacts' as NavTab, label: 'Contacts', icon: Users },
        { id: 'templates' as NavTab, label: 'Templates', icon: FileText },
        { id: 'suppression' as NavTab, label: 'Suppression List', icon: ShieldAlert },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'messages' as NavTab, label: 'Logs', icon: MessageSquareText },
        { id: 'settings' as NavTab, label: 'Settings', icon: SettingsIcon },
      ],
    },
  ];

  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-zinc-900 flex flex-col justify-between transition-transform duration-200 border-r border-zinc-200 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Logo Header */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-zinc-100">
            <EightbitLogo size="md" />
            <button
              onClick={onCloseMobile}
              className="md:hidden text-zinc-400 hover:text-zinc-900 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Session Status Pill */}
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-zinc-700">Session Active</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">v1.0</span>
          </div>

          {/* Nav Items */}
          <div className="p-4 space-y-6">
            {sections.map((section, sIdx) => (
              <div key={sIdx}>
                <h3 className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onTabChange(item.id);
                          onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-[#FF5533] text-white shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                              isActive ? 'bg-white text-[#FF5533]' : 'bg-[#FF5533] text-white'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-200/60">
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-900 truncate">Eightbit Operator</p>
              <p className="text-[11px] text-zinc-500 truncate">{settings.whatsapp_phone || 'Connected'}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
