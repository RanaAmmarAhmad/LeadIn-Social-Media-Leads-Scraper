import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Copy,
  ExternalLink,
  Flame,
  Mail,
  Plus,
  Snowflake,
  Tag,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import {
  getTagStyle,
  normalizeLeadTag,
  PLATFORM_META,
  PRESET_LEAD_TAGS,
  type LeadRecord,
  type LeadStatus,
} from '../types/leadin';

interface LeadInspectorProps {
  lead: LeadRecord | null;
  alertThreshold: number;
  onClose: () => void;
  onUpdateStatus: (leadId: string, status: LeadStatus) => Promise<void>;
  onUpdateTags: (leadId: string, tags: string[]) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onSendAlert: (lead: LeadRecord) => void;
}

const STATUSES: LeadStatus[] = ['new', 'contacted', 'archived'];

function renderTagIcon(tag: string) {
  const key = tag.toLowerCase();
  if (key === 'hot') return <Flame className="w-3 h-3 shrink-0" />;
  if (key === 'cold') return <Snowflake className="w-3 h-3 shrink-0" />;
  if (key === 'long-term') return <Timer className="w-3 h-3 shrink-0" />;
  return <Tag className="w-3 h-3 shrink-0" />;
}

export const LeadInspector: React.FC<LeadInspectorProps> = ({
  lead,
  alertThreshold,
  onClose,
  onUpdateStatus,
  onUpdateTags,
  onDeleteLead,
  onSendAlert,
}) => {
  const [copiedField, setCopiedField] = useState<'contact' | 'pitch' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [busy, setBusy] = useState(false);

  if (!lead) return null;

  const leadTags = lead.tags ?? [];

  const handleCopy = async (text: string, field: 'contact' | 'pitch') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // clipboard blocked
    }
  };

  const handleStatusChange = async (next: LeadStatus) => {
    setBusy(true);
    try {
      await onUpdateStatus(lead.id, next);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTag = async (tag: string) => {
    setBusy(true);
    try {
      const next = leadTags.includes(tag)
        ? leadTags.filter((t) => t !== tag)
        : [...leadTags, tag].slice(0, 8);
      await onUpdateTags(lead.id, next);
    } finally {
      setBusy(false);
    }
  };

  const handleAddCustomTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeLeadTag(customTag);
    if (!clean) return;
    setBusy(true);
    try {
      if (!leadTags.includes(clean)) {
        await onUpdateTags(lead.id, [...leadTags, clean].slice(0, 8));
      }
      setCustomTag('');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await onDeleteLead(lead.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const isHighValue = lead.aiScore >= alertThreshold;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="fixed inset-0 bg-black/65"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Prospect Inspector"
        className="relative z-10 w-full max-w-md bg-[#080C17] border-l border-slate-800 h-full flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-slate-100 truncate">
              {lead.accountName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {PLATFORM_META[lead.platform]?.label || lead.platform} · {lead.postDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* AI Score & Rationale */}
          <div className="pb-5 border-b border-slate-800/80 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-400">
                AI Prospect Score
              </span>
              <span
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  isHighValue
                    ? 'text-teal-300'
                    : lead.aiScore >= 50
                    ? 'text-amber-300'
                    : 'text-slate-400'
                }`}
              >
                {lead.aiScore}/100
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isHighValue
                    ? 'bg-teal-400'
                    : lead.aiScore >= 50
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
                style={{ width: `${lead.aiScore}%` }}
              />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              {lead.aiRationale}
            </p>
          </div>

          {/* Pipeline Status */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-400">
              Outreach Status
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#05070E] border border-slate-800 rounded-lg">
              {STATUSES.map((st) => {
                const active = lead.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={busy}
                    onClick={() => handleStatusChange(st)}
                    className={`py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                      active
                        ? 'bg-teal-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lead Tagging Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Lead Tags ({leadTags.length}/8)
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_LEAD_TAGS.map((preset) => {
                const active = leadTags.includes(preset);
                const style = getTagStyle(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleToggleTag(preset)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      active
                        ? style.className
                        : 'bg-[#05070E] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {renderTagIcon(preset)}
                    {style.label}
                  </button>
                );
              })}

              {leadTags
                .filter((t) => !PRESET_LEAD_TAGS.includes(t as typeof PRESET_LEAD_TAGS[number]))
                .map((custom) => (
                  <button
                    key={custom}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleToggleTag(custom)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border bg-slate-800/90 text-slate-200 border-slate-700 hover:border-rose-500/50 cursor-pointer"
                  >
                    <Tag className="w-3 h-3" />
                    {custom}
                    <X className="w-3 h-3 opacity-70" />
                  </button>
                ))}
            </div>

            <form onSubmit={handleAddCustomTag} className="flex items-center gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add custom tag (e.g. retainer, agency)..."
                maxLength={24}
                className="flex-1 h-9 px-3 bg-[#05070E] border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                disabled={busy || !customTag.trim() || leadTags.length >= 8}
                className="h-9 px-3 inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-teal-400 hover:text-slate-950 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </div>

          {/* Extracted Work Scope */}
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-400">
              Work / Deliverable
            </span>
            <p className="text-sm font-medium text-slate-100">{lead.work}</p>
          </div>

          {/* Contact & Link */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Contact</span>
              <button
                type="button"
                onClick={() => handleCopy(lead.contact, 'contact')}
                className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200 cursor-pointer"
              >
                {copiedField === 'contact' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="p-3 bg-[#05070E] border border-slate-800 rounded-lg font-mono text-xs text-slate-200 break-all">
              {lead.contact}
            </div>
            {lead.link && (
              <a
                href={lead.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200 hover:underline pt-1"
              >
                Open original post
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Original Post */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-400">
              Original Post
            </span>
            <div className="p-3.5 bg-[#05070E] border border-slate-800 rounded-lg text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
              {lead.post}
            </div>
          </div>

          {/* AI Suggested Pitch */}
          {lead.suggestedPitch && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  Suggested Outreach Pitch
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(lead.suggestedPitch, 'pitch')}
                  className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200 cursor-pointer"
                >
                  {copiedField === 'pitch' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Pitch
                    </>
                  )}
                </button>
              </div>
              <div className="p-3.5 bg-[#05070E] border border-slate-800 rounded-lg text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {lead.suggestedPitch}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-[#05070E]">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-400 cursor-pointer"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onSendAlert(lead)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" />
            {lead.alertSent ? 'Resend Gmail Alert' : 'Send Gmail Alert'}
          </button>
        </div>
      </motion.aside>
    </div>
  );
};
