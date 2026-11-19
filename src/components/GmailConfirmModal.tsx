import React from 'react';
import { Loader2, Mail, X } from 'lucide-react';
import type { LeadRecord } from '../types/leadin';

interface GmailConfirmModalProps {
  open: boolean;
  leads: LeadRecord[];
  recipientEmail: string;
  subject: string;
  gmailConnected: boolean;
  sending: boolean;
  onReconnectGmail: () => Promise<void>;
  onConfirmSend: () => Promise<void>;
  onCancel: () => void;
}

export const GmailConfirmModal: React.FC<GmailConfirmModalProps> = ({
  open,
  leads,
  recipientEmail,
  subject,
  gmailConnected,
  sending,
  onReconnectGmail,
  onConfirmSend,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-confirm-title"
    >
      <div
        className="fixed inset-0 bg-black/70"
        onClick={sending ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg spatial-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-teal-300" />
            <h2
              id="gmail-confirm-title"
              className="font-display text-base font-semibold text-slate-100"
            >
              Confirm Gmail Prospect Alert
            </h2>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={onCancel}
            aria-label="Cancel email send"
            className="p-1 text-slate-400 hover:text-slate-100 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <p className="text-slate-300 leading-relaxed">
            You are about to send an alert email through your connected Gmail account summarizing{' '}
            <strong className="text-slate-100 font-mono tabular-nums">
              {leads.length}
            </strong>{' '}
            high-value freelance prospect{leads.length === 1 ? '' : 's'}.
          </p>

          <dl className="space-y-2 p-3.5 bg-[#05070E] border border-slate-800 rounded-xl text-xs">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-500">Recipient</dt>
              <dd className="font-mono text-slate-200 truncate">{recipientEmail}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-500">Subject</dt>
              <dd className="text-slate-200 text-right truncate">{subject}</dd>
            </div>
          </dl>

          <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-[#05070E]">
            {leads.slice(0, 12).map((lead) => (
              <div
                key={lead.id}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">
                    {lead.accountName}
                  </div>
                  <div className="text-slate-500 truncate">{lead.work}</div>
                </div>
                <span className="font-mono font-semibold text-teal-300 tabular-nums shrink-0">
                  {lead.aiScore}/100
                </span>
              </div>
            ))}
            {leads.length > 12 && (
              <div className="px-3.5 py-2 text-xs text-slate-500">
                + {leads.length - 12} additional prospects included in this email
              </div>
            )}
          </div>

          {!gmailConnected && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <p>
                Your in-memory Gmail session token is not active for this browser tab. Re-authorize Google Sign-In to send emails.
              </p>
              <button
                type="button"
                onClick={onReconnectGmail}
                className="px-3 py-1.5 rounded-md bg-amber-400 text-slate-950 font-semibold hover:bg-amber-300 transition-colors cursor-pointer"
              >
                Reconnect Google & Gmail
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-[#05070E] border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={sending}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sending || !gmailConnected || leads.length === 0}
            onClick={onConfirmSend}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending via Gmail...
              </>
            ) : (
              'Send Email via Gmail'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
