import React from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Box,
  History,
  LogOut,
  Puzzle,
  Radar,
  Table2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  PLATFORM_META,
  type CampaignRecord,
} from '../types/leadin';

export type WorkspaceTab = 'console' | 'leads' | 'alerts' | 'extension';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  user: User;
  gmailConnected: boolean;
  onReconnectGmail: () => void;
  onLogout: () => void;
  campaigns: CampaignRecord[];
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string | null) => void;
  totalLeads: number;
  hotLeadsCount: number;
  pendingHighValueCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  gmailConnected,
  onReconnectGmail,
  onLogout,
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  totalLeads,
  hotLeadsCount,
  pendingHighValueCount,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'console', label: 'Scrape Console', icon: Radar },
    { id: 'leads', label: 'Lead Sheet', icon: Table2, count: totalLeads },
    {
      id: 'alerts',
      label: 'Gmail Alerts',
      icon: Bell,
      count: pendingHighValueCount > 0 ? pendingHighValueCount : undefined,
    },
    { id: 'extension', label: 'Chrome Extension', icon: Puzzle },
  ];

  const handleNavClick = (id: WorkspaceTab) => {
    onSelectTab(id);
    if (id !== 'leads') {
      onSelectCampaign(null);
    }
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#080C17]/95 border-r border-slate-800/80 w-[256px]">
      {/* Brand Lockup */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('console')}
          className="flex items-center gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400/25 via-teal-500/10 to-amber-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
            <Box className="w-4 h-4" />
          </span>
          <span className="font-display text-lg font-bold text-slate-100 tracking-tight whitespace-nowrap">
            Leadin
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 rounded-md cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="p-3 space-y-1 shrink-0" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'text-teal-200'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/45'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="leadin-sidebar-active"
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-teal-400/12 border border-teal-400/35"
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-teal-300' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && (
                <span
                  className={`relative z-10 font-mono text-xs tabular-nums ${
                    item.id === 'alerts' && item.count > 0
                      ? 'text-amber-300 font-semibold'
                      : 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Pipeline Tag Pulse Summary */}
      <div className="px-4 py-2.5 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
        <span>Hot Tagged Leads</span>
        <span className="font-mono font-semibold text-rose-300 tabular-nums">
          {hotLeadsCount}
        </span>
      </div>

      {/* Recent Campaigns History */}
      <div className="flex-1 overflow-y-auto px-3 py-3 border-t border-slate-800/70">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <History className="w-3.5 h-3.5 text-slate-500" />
            Recent Runs
          </span>
          {selectedCampaignId && (
            <button
              type="button"
              onClick={() => onSelectCampaign(null)}
              className="text-xs text-teal-300 hover:text-teal-200 cursor-pointer"
            >
              Show all
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-500 leading-relaxed">
            No scrape runs yet. Select a social platform and hit Enter to capture your first leads.
          </p>
        ) : (
          <ul className="space-y-1">
            {campaigns.slice(0, 8).map((c) => {
              const selected = selectedCampaignId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCampaign(selected ? null : c.id);
                      onSelectTab('leads');
                      onCloseMobile();
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                      selected
                        ? 'bg-teal-500/12 border border-teal-500/30 text-slate-100'
                        : 'hover:bg-slate-800/50 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium truncate">
                        {PLATFORM_META[c.platform]?.label || c.platform}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                        {c.leadsFoundCount} leads
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.keywords || 'All freelance posts'} · {c.dateFilter}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Account & Gmail Session Footer */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5 shrink-0">
        {!gmailConnected && (
          <button
            type="button"
            onClick={onReconnectGmail}
            className="w-full px-3 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
          >
            Reconnect Google to enable Gmail sending
          </button>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-200 truncate">
              {user.displayName || 'Workspace Member'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {user.email}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-20">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
