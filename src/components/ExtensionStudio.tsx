import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Puzzle,
} from 'lucide-react';
import { downloadChromeExtensionZip } from '../lib/extensionPackager';
import {
  buildSocialSearchUrl,
  DATE_FILTER_LABELS,
  PLATFORM_META,
  type DateFilter,
  type LeadRecord,
  type SocialPlatform,
} from '../types/leadin';
import type { ScrapeLaunchPayload } from './CommandLauncher';
import { SpatialCard } from './SpatialCard';

interface ExtensionStudioProps {
  recentLeads: LeadRecord[];
  isScraping: boolean;
  onRunPopupScrape: (payload: ScrapeLaunchPayload) => Promise<void>;
}

export const ExtensionStudio: React.FC<ExtensionStudioProps> = ({
  recentLeads,
  isScraping,
  onRunPopupScrape,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [dateFilter, setDateFilter] = useState<DateFilter>('24h');
  const [keywords, setKeywords] = useState('looking for freelance developer');
  const [customUrl, setCustomUrl] = useState('');

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await downloadChromeExtensionZip();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 4000);
    } finally {
      setDownloading(false);
    }
  };

  const handlePopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = buildSocialSearchUrl(platform, keywords, dateFilter, '', customUrl);
    await onRunPopupScrape({
      platform,
      dateFilter,
      customDate: '',
      keywords,
      targetUrl,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <SpatialCard tilt={false} className="lg:col-span-7 rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">
              Leadin Chrome Extension (Manifest V3)
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl leading-relaxed">
              Install Leadin directly in Chrome, Edge, or Brave to automatically open your logged-in Facebook groups, LinkedIn feed, X search, or Reddit threads on Enter and scrape freelance posts right from the live browser DOM.
            </p>
          </div>
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadZip}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 hover:from-teal-300 hover:to-emerald-300 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download Extension (.zip)
          </button>
        </div>

        {downloaded && (
          <div className="flex items-center gap-2 text-xs text-teal-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              leadin-chrome-extension.zip downloaded. Unzip it and load unpacked in chrome://extensions.
            </span>
          </div>
        )}

        <div className="border-t border-slate-800/80 pt-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-slate-200">
            Installation in 3 Steps
          </h3>
          <ol className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="font-mono text-xs text-teal-300 pt-0.5 shrink-0">01.</span>
              <span>
                Unzip <code className="text-slate-200">leadin-chrome-extension.zip</code> to a permanent folder on your machine.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-teal-300 pt-0.5 shrink-0">02.</span>
              <span>
                Navigate to <code className="text-slate-200">chrome://extensions</code> and switch on <strong className="text-slate-100">Developer mode</strong> in the top right.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-teal-300 pt-0.5 shrink-0">03.</span>
              <span>
                Click <strong className="text-slate-100">Load unpacked</strong>, pick the unzipped folder, and pin Leadin to your toolbar. Hit Enter inside the popup to auto-open Facebook/LinkedIn tabs, scrape leads into the 6-column format, and copy JSON into this workspace for AI scoring & Gmail alerts.
              </span>
            </li>
          </ol>
        </div>

        <div className="border-t border-slate-800/80 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-semibold text-slate-200">Automated Tab & DOM Capture</div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Opens the selected social search URL, auto-scrolls the feed, and filters for freelance intent keywords.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-200">Exact 6-Column Output</div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Extracts Account Name, Date, Work, Post, Link, and Contact into downloadable Excel (.csv) and printable PDF sheets.
            </p>
          </div>
        </div>
      </SpatialCard>

      <SpatialCard tilt maxTilt={3.5} delay={0.06} className="lg:col-span-5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-teal-300" />
            <span className="font-display font-semibold text-slate-100">
              Leadin Popup Preview
            </span>
          </div>
          <span className="text-xs text-slate-400">Interactive MV3 mirror</span>
        </div>

        <form onSubmit={handlePopupSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="popup-platform"
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Platform
              </label>
              <select
                id="popup-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                className="w-full h-9 px-2.5 bg-[#05070E] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-400"
              >
                {(['linkedin', 'facebook', 'x', 'reddit', 'custom'] as SocialPlatform[]).map(
                  (p) => (
                    <option key={p} value={p}>
                      {PLATFORM_META[p].label}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label
                htmlFor="popup-date"
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Post Date
              </label>
              <select
                id="popup-date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="w-full h-9 px-2.5 bg-[#05070E] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-400"
              >
                {(['24h', '7d', '30d'] as DateFilter[]).map((d) => (
                  <option key={d} value={d}>
                    {DATE_FILTER_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="popup-keywords"
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              Work / Niche Keywords (Hit Enter)
            </label>
            <input
              id="popup-keywords"
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full h-9 px-2.5 bg-[#05070E] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-400"
            />
          </div>

          {platform === 'custom' && (
            <div>
              <label
                htmlFor="popup-custom-url"
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Target URL
              </label>
              <input
                id="popup-custom-url"
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-9 px-2.5 bg-[#05070E] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-400"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isScraping}
              className="flex-1 h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-400 text-slate-950 font-semibold text-xs hover:bg-teal-300 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isScraping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  Run Scrape (Enter)
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            <a
              href={buildSocialSearchUrl(platform, keywords, dateFilter, '', customUrl)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open target social URL"
              className="h-9 px-2.5 inline-flex items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </form>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#05070E]">
          <div className="px-3 py-2 bg-[#0B101D] border-b border-slate-800 text-[11px] font-medium text-slate-400 flex justify-between">
            <span>Recent Captured Rows</span>
            <span className="font-mono tabular-nums">{recentLeads.length} total</span>
          </div>
          {recentLeads.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-500">
              Press Enter above to test a live scrape into your workspace.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70 max-h-48 overflow-y-auto text-xs">
              {recentLeads.slice(0, 5).map((lead) => (
                <li
                  key={lead.id}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">
                      {lead.accountName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {lead.work} · {lead.postDate}
                    </div>
                  </div>
                  <span className="font-mono text-teal-300 tabular-nums shrink-0">
                    {lead.aiScore}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SpatialCard>
    </div>
  );
};
