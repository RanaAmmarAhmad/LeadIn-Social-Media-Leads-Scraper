import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Mail, Save } from 'lucide-react';
import type { AlertLogRecord, LeadRecord, UserProfile } from '../types/leadin';
import { SpatialCard } from './SpatialCard';

interface AlertsViewProps {
  profile: UserProfile | null;
  leads: LeadRecord[];
  alertLogs: AlertLogRecord[];
  gmailConnected: boolean;
  onReconnectGmail: () => Promise<void>;
  onSaveSettings: (updates: {
    displayName: string;
    alertThreshold: number;
    alertRecipient: string;
    defaultKeywords: string;
  }) => Promise<void>;
  onTriggerAlertForLeads: (leads: LeadRecord[]) => void;
  onSelectLead: (lead: LeadRecord) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  profile,
  leads,
  alertLogs,
  gmailConnected,
  onReconnectGmail,
  onSaveSettings,
  onTriggerAlertForLeads,
  onSelectLead,
}) => {
  const [threshold, setThreshold] = useState<number>(profile?.alertThreshold ?? 80);
  const [recipient, setRecipient] = useState<string>(profile?.alertRecipient ?? '');
  const [defaultKeywords, setDefaultKeywords] = useState<string>(
    profile?.defaultKeywords ?? 'looking for freelance developer designer'
  );
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (profile) {
      setThreshold(profile.alertThreshold);
      setRecipient(profile.alertRecipient);
      setDefaultKeywords(profile.defaultKeywords);
    }
  }, [profile]);

  const pendingHighValue = leads.filter(
    (l) => l.aiScore >= threshold && !l.alertSent
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await onSaveSettings({
        displayName: profile.displayName,
        alertThreshold: threshold,
        alertRecipient: recipient.trim() || profile.email,
        defaultKeywords: defaultKeywords.trim(),
      });
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SpatialCard tilt={false} className="lg:col-span-5 rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-slate-100">
              High-Value Alert Rules
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Prospects scoring at or above your threshold are queued for Gmail alerts.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="alert-threshold"
                  className="text-xs font-medium text-slate-300"
                >
                  Minimum AI Score Threshold
                </label>
                <span className="font-mono text-sm font-semibold text-teal-300 tabular-nums">
                  {threshold}/100
                </span>
              </div>
              <input
                id="alert-threshold"
                type="range"
                min={50}
                max={95}
                step={5}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
                <span>50 Warm</span>
                <span>80 Recommended</span>
                <span>95 Strict</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="alert-recipient"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Alert Recipient Email
              </label>
              <input
                id="alert-recipient"
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full h-10 px-3 bg-[#05070E] border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-400"
              />
            </div>

            <div>
              <label
                htmlFor="default-keywords"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Default Freelance Niche Keywords
              </label>
              <input
                id="default-keywords"
                type="text"
                value={defaultKeywords}
                onChange={(e) => setDefaultKeywords(e.target.value)}
                placeholder="React developer, UI designer, video editor"
                className="w-full h-10 px-3 bg-[#05070E] border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-400"
              />
            </div>

            <div className="pt-1 flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Rules'}
              </button>

              {savedBanner && (
                <span className="inline-flex items-center gap-1 text-xs text-teal-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved to cloud
                </span>
              )}
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              Gmail Delivery:{' '}
              <strong className={gmailConnected ? 'text-teal-300' : 'text-amber-300'}>
                {gmailConnected ? 'Connected' : 'Authorization Needed'}
              </strong>
            </span>
            {!gmailConnected && (
              <button
                type="button"
                onClick={onReconnectGmail}
                className="text-amber-300 hover:text-amber-200 underline cursor-pointer"
              >
                Connect Gmail
              </button>
            )}
          </div>
        </SpatialCard>

        <SpatialCard tilt={false} delay={0.05} className="lg:col-span-7 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Pending High-Value Queue
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {pendingHighValue.length} unalerted prospect{pendingHighValue.length === 1 ? '' : 's'} scoring {threshold}+
              </p>
            </div>
            <button
              type="button"
              disabled={pendingHighValue.length === 0}
              onClick={() => onTriggerAlertForLeads(pendingHighValue)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <Mail className="w-3.5 h-3.5" />
              Send Digest Alert ({pendingHighValue.length})
            </button>
          </div>

          {pendingHighValue.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-300 font-medium">
                All high-value prospects are up to date
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Run a new scrape on Facebook, LinkedIn, X, or Reddit to surface fresh high-scoring freelance gigs.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70 max-h-[380px] overflow-y-auto">
              {pendingHighValue.map((lead) => (
                <li
                  key={lead.id}
                  className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectLead(lead)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-100 truncate">
                        {lead.accountName}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 uppercase">{lead.platform}</span>
                      <span className="text-slate-500">·</span>
                      <span className="font-mono text-slate-400">{lead.postDate}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                      {lead.work} — {lead.contact}
                    </p>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-semibold text-teal-300 tabular-nums">
                      {lead.aiScore}/100
                    </span>
                    <button
                      type="button"
                      onClick={() => onTriggerAlertForLeads([lead])}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-700 text-slate-200 hover:border-teal-400 hover:text-teal-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Send Alert
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SpatialCard>
      </div>

      <SpatialCard tilt={false} delay={0.1} className="rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Sent Gmail Alert History
          </h2>
        </div>
        {alertLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No Gmail alert emails have been dispatched yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-[#080C17] border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="py-2.5 px-5">Subject</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4 text-right">Prospects</th>
                  <th className="py-2.5 px-5 text-right">Gmail Message ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {alertLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/35">
                    <td className="py-3 px-5 text-slate-200 font-medium">
                      {log.subject}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.recipientEmail}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-teal-300 tabular-nums">
                      {log.highValueCount}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-500">
                      {log.gmailMessageId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SpatialCard>
    </div>
  );
};
