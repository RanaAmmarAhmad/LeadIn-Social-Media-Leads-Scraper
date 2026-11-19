import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  ArrowUpDown,
  CheckCircle2,
  CircleDot,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Flame,
  Mail,
  Plus,
  Search,
  SlidersHorizontal,
  Snowflake,
  Tag,
  Timer,
  X,
} from 'lucide-react';
import {
  getTagStyle,
  normalizeLeadTag,
  PLATFORM_META,
  PRESET_LEAD_TAGS,
  type LeadRecord,
  type LeadStatus,
  type SocialPlatform,
} from '../types/leadin';
import {
  exportLeadsToExcel,
  exportLeadsToJson,
  exportLeadsToPdf,
} from '../lib/exporters';

interface LeadTableProps {
  leads: LeadRecord[];
  loading: boolean;
  selectedLeadId: string | null;
  onSelectLead: (lead: LeadRecord) => void;
  onUpdateTags: (leadId: string, tags: string[]) => Promise<void>;
  onTriggerAlertForLeads: (leads: LeadRecord[]) => void;
  alertThreshold: number;
  activeCampaignLabel?: string | null;
  onClearCampaignFilter?: () => void;
}

type SortField = 'aiScore' | 'postDate' | 'accountName';
type LeadViewFilter = 'all' | 'high-value' | 'newest';

const VIEW_FILTER_LABELS: Record<LeadViewFilter, string> = {
  all: 'All Leads',
  'high-value': 'High-Value Only',
  newest: 'Newest',
};

const STATUS_BADGE_MAP: Record<
  LeadStatus,
  {
    label: string;
    className: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  new: {
    label: 'New',
    className: 'bg-teal-500/15 text-teal-300 border-teal-500/35',
    Icon: CircleDot,
  },
  contacted: {
    label: 'Contacted',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    Icon: CheckCircle2,
  },
  archived: {
    label: 'Archived',
    className: 'bg-slate-800/90 text-slate-400 border-slate-700/80',
    Icon: Archive,
  },
};

function renderTagIcon(tag: string) {
  const key = tag.toLowerCase();
  if (key === 'hot') return <Flame className="w-3 h-3 shrink-0" />;
  if (key === 'cold') return <Snowflake className="w-3 h-3 shrink-0" />;
  if (key === 'long-term') return <Timer className="w-3 h-3 shrink-0" />;
  return <Tag className="w-2.5 h-2.5 shrink-0" />;
}

function getTimestampMillis(lead: LeadRecord): number {
  const created = lead.createdAt as { toMillis?: () => number; seconds?: number } | undefined;
  if (created && typeof created.toMillis === 'function') {
    return created.toMillis();
  }
  if (created && typeof created.seconds === 'number') {
    return created.seconds * 1000;
  }
  const parsed = Date.parse(lead.postDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  loading,
  selectedLeadId,
  onSelectLead,
  onUpdateTags,
  onTriggerAlertForLeads,
  alertThreshold,
  activeCampaignLabel,
  onClearCampaignFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<LeadViewFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortField, setSortField] = useState<SortField>('aiScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [openTagEditorId, setOpenTagEditorId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState('');

  const availableTags = useMemo(() => {
    const set = new Set<string>(PRESET_LEAD_TAGS);
    for (const l of leads) {
      for (const t of l.tags ?? []) {
        set.add(t);
      }
    }
    return Array.from(set);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = leads.filter((lead) => {
      if (viewFilter === 'high-value' && lead.aiScore < alertThreshold) return false;
      if (tagFilter !== 'all' && !(lead.tags ?? []).includes(tagFilter)) return false;
      if (platformFilter !== 'all' && lead.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (lead.aiScore < minScore) return false;
      if (!q) return true;
      return (
        lead.accountName.toLowerCase().includes(q) ||
        lead.work.toLowerCase().includes(q) ||
        lead.post.toLowerCase().includes(q) ||
        lead.contact.toLowerCase().includes(q) ||
        (lead.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });

    if (viewFilter === 'newest') {
      return [...list].sort((a, b) => {
        const diff = getTimestampMillis(b) - getTimestampMillis(a);
        if (diff !== 0) return diff;
        return b.postDate.localeCompare(a.postDate);
      });
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'aiScore') {
        cmp = a.aiScore - b.aiScore;
      } else if (sortField === 'accountName') {
        cmp = a.accountName.localeCompare(b.accountName);
      } else {
        cmp = a.postDate.localeCompare(b.postDate);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    leads,
    searchQuery,
    viewFilter,
    tagFilter,
    alertThreshold,
    platformFilter,
    statusFilter,
    minScore,
    sortField,
    sortDir,
  ]);

  const toggleSort = (field: SortField) => {
    if (viewFilter === 'newest') {
      setViewFilter('all');
    }
    if (sortField === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const highValueVisible = useMemo(
    () => filteredLeads.filter((l) => l.aiScore >= alertThreshold),
    [filteredLeads, alertThreshold]
  );

  const handleToggleLeadTag = async (lead: LeadRecord, tag: string) => {
    const existing = lead.tags ?? [];
    const next = existing.includes(tag)
      ? existing.filter((t) => t !== tag)
      : [...existing, tag].slice(0, 8);
    await onUpdateTags(lead.id, next);
  };

  const handleAddCustomTag = async (lead: LeadRecord) => {
    const clean = normalizeLeadTag(customTagInput);
    if (!clean) return;
    const existing = lead.tags ?? [];
    if (!existing.includes(clean)) {
      await onUpdateTags(lead.id, [...existing, clean].slice(0, 8));
    }
    setCustomTagInput('');
  };

  const handleExportFilteredPdf = () => {
    const filterSummary = [
      VIEW_FILTER_LABELS[viewFilter],
      tagFilter !== 'all' ? `Tag: ${getTagStyle(tagFilter).label}` : null,
      statusFilter !== 'all' ? `Status: ${statusFilter}` : null,
    ]
      .filter(Boolean)
      .join(' / ');

    exportLeadsToPdf(filteredLeads, {
      filterLabel: filterSummary || 'All Leads',
      alertThreshold,
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Scraped Freelance Leads"
      className="spatial-panel rounded-2xl overflow-hidden"
    >
      {/* Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Scraped Leads
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {filteredLeads.length} of {leads.length} rows · {highValueVisible.length} high-value ({alertThreshold}+)
            </span>
            {activeCampaignLabel && (
              <span className="text-xs text-teal-300 flex items-center gap-2">
                <span>Run: {activeCampaignLabel}</span>
                {onClearCampaignFilter && (
                  <button
                    type="button"
                    onClick={onClearCampaignFilter}
                    className="underline hover:text-teal-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </span>
            )}
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={filteredLeads.length === 0}
              onClick={() => exportLeadsToExcel(filteredLeads)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#070B14] border border-slate-700/80 text-slate-200 hover:border-teal-400/60 hover:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
              Export Excel (.xlsx)
            </button>
            <button
              type="button"
              disabled={filteredLeads.length === 0}
              onClick={handleExportFilteredPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#070B14] border border-slate-700/80 text-slate-200 hover:border-teal-400/60 hover:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Download PDF
            </button>
            <button
              type="button"
              disabled={filteredLeads.length === 0}
              onClick={() => exportLeadsToJson(filteredLeads)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#070B14] border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
            {highValueVisible.length > 0 && (
              <button
                type="button"
                onClick={() => onTriggerAlertForLeads(highValueVisible)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-500/15 border border-teal-400/40 text-teal-200 hover:bg-teal-500/25 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                Alert High-Value ({highValueVisible.length})
              </button>
            )}
          </div>
        </div>

        {/* Live Search & Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="lg:col-span-3 relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search account, work, tags, contact..."
              aria-label="Search leads"
              className="w-full h-9 pl-8 pr-3 bg-[#070B14] border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value as LeadViewFilter)}
              aria-label="Filter view mode"
              className="w-full h-9 px-2.5 bg-[#070B14] border border-teal-500/40 rounded-lg text-xs font-medium text-teal-300 focus:outline-none focus:border-teal-400"
            >
              <option value="all">All Leads</option>
              <option value="high-value">High-Value Only ({alertThreshold}+)</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filter by lead tag"
              className="w-full h-9 px-2.5 bg-[#070B14] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-400"
            >
              <option value="all">All Tags</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  Tag: {getTagStyle(t).label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | 'all')}
              aria-label="Filter by platform"
              className="w-full h-9 px-2.5 bg-[#070B14] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-400"
            >
              <option value="all">All Platforms</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="x">X / Twitter</option>
              <option value="reddit">Reddit</option>
              <option value="custom">Custom URL</option>
            </select>
          </div>

          <div className="lg:col-span-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
              aria-label="Filter by status"
              className="w-full h-9 px-2 bg-[#070B14] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-400"
            >
              <option value="all">Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center gap-2 px-2.5 h-9 bg-[#070B14] border border-slate-800 rounded-lg">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              id="min-score-slider"
              type="range"
              min={0}
              max={95}
              step={5}
              value={minScore}
              aria-label="Minimum AI score"
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
            <span className="font-mono text-xs text-teal-300 tabular-nums w-6 text-right">
              {minScore}
            </span>
          </div>
        </div>
      </div>

      {/* 6-Column + Status/Tag Badges + AI Score Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1040px]">
          <thead>
            <tr className="bg-[#080C17] border-b border-slate-800/90 text-xs font-medium text-slate-400">
              <th className="py-3 px-4 w-[225px]">
                <button
                  type="button"
                  onClick={() => toggleSort('accountName')}
                  className="inline-flex items-center gap-1 hover:text-slate-100 cursor-pointer whitespace-nowrap"
                >
                  Account Name & Status
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 w-[100px]">
                <button
                  type="button"
                  onClick={() => toggleSort('postDate')}
                  className="inline-flex items-center gap-1 hover:text-slate-100 cursor-pointer whitespace-nowrap"
                >
                  Date
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 w-[175px]">Work</th>
              <th className="py-3 px-3">Post & Tags</th>
              <th className="py-3 px-3 w-[84px]">Link</th>
              <th className="py-3 px-3 w-[165px]">Contact</th>
              <th className="py-3 px-4 w-[108px] text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('aiScore')}
                  className="inline-flex items-center gap-1 hover:text-slate-100 cursor-pointer whitespace-nowrap ml-auto"
                >
                  AI Score
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/65 text-sm">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-4">
                    <div className="h-3.5 bg-slate-800 rounded w-32" />
                  </td>
                  <td className="py-4 px-3">
                    <div className="h-3.5 bg-slate-800 rounded w-16" />
                  </td>
                  <td className="py-4 px-3">
                    <div className="h-3.5 bg-slate-800 rounded w-32" />
                  </td>
                  <td className="py-4 px-3">
                    <div className="h-3.5 bg-slate-800 rounded w-full max-w-md" />
                  </td>
                  <td className="py-4 px-3">
                    <div className="h-3.5 bg-slate-800 rounded w-12" />
                  </td>
                  <td className="py-4 px-3">
                    <div className="h-3.5 bg-slate-800 rounded w-28" />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="h-3.5 bg-slate-800 rounded w-14 ml-auto" />
                  </td>
                </tr>
              ))
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 px-6 text-center">
                  <p className="text-sm font-medium text-slate-200">
                    {leads.length === 0
                      ? 'No freelance leads captured yet'
                      : 'No leads match your active filters'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    {leads.length === 0
                      ? 'Choose Facebook, LinkedIn, X, Reddit, or a Custom URL above and hit Enter to scrape freelance work into this 6-column sheet.'
                      : 'Adjust the view mode, tag filter, or minimum AI score slider to reveal saved prospects.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = selectedLeadId === lead.id;
                const statusInfo = STATUS_BADGE_MAP[lead.status] || STATUS_BADGE_MAP.new;
                const StatusIcon = statusInfo.Icon;
                const leadTags = lead.tags ?? [];
                const isEditingTags = openTagEditorId === lead.id;

                const scoreColor =
                  lead.aiScore >= alertThreshold
                    ? 'text-teal-300'
                    : lead.aiScore >= 50
                    ? 'text-amber-300'
                    : 'text-slate-400';
                const tierLabel =
                  lead.aiScore >= alertThreshold
                    ? 'High'
                    : lead.aiScore >= 50
                    ? 'Warm'
                    : 'Low';

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/10'
                        : 'hover:bg-slate-800/45'
                    }`}
                  >
                    {/* Account Name + Visual Status Badge */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-100 truncate max-w-[140px]">
                          {lead.accountName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border whitespace-nowrap ${statusInfo.className}`}
                        >
                          <StatusIcon className="w-3 h-3 shrink-0" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {PLATFORM_META[lead.platform]?.label || lead.platform}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 align-top font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {lead.postDate}
                    </td>

                    <td className="py-3.5 px-3 align-top">
                      <div className="text-xs font-medium text-slate-200 line-clamp-2">
                        {lead.work}
                      </div>
                    </td>

                    {/* Post excerpt + interactive lead tag system */}
                    <td className="py-3.5 px-3 align-top space-y-2">
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {lead.post}
                      </p>

                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {leadTags.map((tag) => {
                          const style = getTagStyle(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => void handleToggleLeadTag(lead, tag)}
                              title={`Remove "${style.label}" tag`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-opacity hover:opacity-80 cursor-pointer whitespace-nowrap ${style.className}`}
                            >
                              {renderTagIcon(tag)}
                              <span>{style.label}</span>
                              <X className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setOpenTagEditorId(isEditingTags ? null : lead.id);
                            setCustomTagInput('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-slate-700/80 bg-[#070B14] text-slate-400 hover:text-teal-300 hover:border-teal-500/40 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          Tag
                        </button>
                      </div>

                      {isEditingTags && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1.5 p-2.5 rounded-lg bg-[#070B14] border border-slate-700/90 space-y-2 max-w-xs"
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_LEAD_TAGS.map((preset) => {
                              const active = leadTags.includes(preset);
                              const style = getTagStyle(preset);
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => void handleToggleLeadTag(lead, preset)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                                    active
                                      ? style.className
                                      : 'border-slate-700 text-slate-400 hover:text-slate-100'
                                  }`}
                                >
                                  {renderTagIcon(preset)}
                                  {style.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={customTagInput}
                              onChange={(e) => setCustomTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleAddCustomTag(lead);
                                }
                              }}
                              placeholder="Custom tag + Enter"
                              className="flex-1 h-7 px-2 bg-[#0D1320] border border-slate-700 rounded text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddCustomTag(lead)}
                              className="h-7 px-2.5 text-[11px] font-semibold rounded bg-teal-500 text-slate-950 hover:bg-teal-400 cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td
                      className="py-3.5 px-3 align-top whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.link ? (
                        <a
                          href={lead.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200 hover:underline"
                        >
                          Post
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 align-top">
                      <div className="text-xs font-mono text-slate-300 truncate max-w-[155px]">
                        {lead.contact}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <div className={`font-mono text-sm font-semibold tabular-nums ${scoreColor}`}>
                        {lead.aiScore}/100
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {tierLabel}
                        {lead.alertSent ? ' · Alerted' : ''}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
};
