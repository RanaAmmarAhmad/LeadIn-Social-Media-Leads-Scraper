import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Calendar,
  ClipboardPaste,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  Upload,
} from 'lucide-react';
import {
  buildSocialSearchUrl,
  DATE_FILTER_LABELS,
  PLATFORM_META,
  type DateFilter,
  type SocialPlatform,
} from '../types/leadin';

export interface ScrapeLaunchPayload {
  platform: SocialPlatform;
  dateFilter: DateFilter;
  customDate: string;
  keywords: string;
  targetUrl: string;
  rawContent?: string;
}

interface CommandLauncherProps {
  defaultKeywords: string;
  isScraping: boolean;
  scrapeStage: string;
  onLaunchScrape: (payload: ScrapeLaunchPayload) => Promise<void>;
}

const PLATFORMS: SocialPlatform[] = ['linkedin', 'facebook', 'x', 'reddit', 'custom'];
const DATE_OPTIONS: DateFilter[] = ['24h', '7d', '30d', 'custom'];

export const CommandLauncher: React.FC<CommandLauncherProps> = ({
  defaultKeywords,
  isScraping,
  scrapeStage,
  onLaunchScrape,
}) => {
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [keywords, setKeywords] = useState<string>(
    defaultKeywords || 'looking for freelance developer designer'
  );
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [showImportDrawer, setShowImportDrawer] = useState<boolean>(false);
  const [rawContent, setRawContent] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const resolvedUrl = buildSocialSearchUrl(
    platform,
    keywords,
    dateFilter,
    customDate,
    targetUrl
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (platform === 'custom' && !rawContent.trim() && !targetUrl.trim().startsWith('http')) {
      setValidationError(
        'Enter a valid https:// URL for Custom Social URL scraping, or paste feed content below.'
      );
      return;
    }

    await onLaunchScrape({
      platform,
      dateFilter,
      customDate,
      keywords: keywords.trim() || 'looking for freelancer',
      targetUrl: resolvedUrl,
      rawContent: rawContent.trim() || undefined,
    });

    if (rawContent.trim()) {
      setRawContent('');
      setShowImportDrawer(false);
    }
  };

  const handleJsonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawContent(text);
      setShowImportDrawer(true);
    } catch {
      setValidationError('Could not read the selected file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Social Media Lead Scraper"
      className="spatial-panel rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">
            Launch Freelance Lead Scrape
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Select a platform and post date, type your niche keywords, and hit Enter to scrape and score prospects with AI.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-teal-300 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open {PLATFORM_META[platform].label} Tab
          </a>
          <button
            type="button"
            onClick={() => setShowImportDrawer((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            {showImportDrawer ? 'Hide Extension / Paste Import' : 'Import Extension JSON / Paste Feed'}
          </button>
        </div>
      </div>

      {/* Platform Segmented Selector */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label="Target social platform"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#05070E] border border-slate-800 rounded-xl"
          >
            {PLATFORMS.map((p) => {
              const active = platform === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPlatform(p)}
                  className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-teal-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {PLATFORM_META[p].label}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-500">
            {PLATFORM_META[platform].domain} · {PLATFORM_META[platform].searchHint}
          </span>
        </div>

        {/* Main Command Input Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label
              htmlFor="leadin-date-filter"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Post Date / Recency
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="leadin-date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="w-full h-11 pl-9 pr-3 bg-[#05070E] border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-400 transition-colors"
              >
                {DATE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {DATE_FILTER_LABELS[opt]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="md:col-span-2">
              <label
                htmlFor="leadin-custom-date"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Posts Since
              </label>
              <input
                id="leadin-custom-date"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full h-11 px-3 bg-[#05070E] border border-slate-700/80 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-teal-400 transition-colors"
              />
            </div>
          )}

          <div className={dateFilter === 'custom' ? 'md:col-span-5' : 'md:col-span-7'}>
            <label
              htmlFor="leadin-keywords"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Freelance Work Keywords (press Enter to start)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="leadin-keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. hiring React developer, need UI designer, freelance video editor"
                className="w-full h-11 pl-10 pr-4 bg-[#05070E] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex items-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isScraping}
              className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 font-semibold text-sm hover:from-teal-300 hover:to-emerald-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  Start Scrape
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </div>

        {platform === 'custom' && (
          <div>
            <label
              htmlFor="leadin-custom-url"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Target Social Group or Thread URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="leadin-custom-url"
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://www.indiehackers.com/ or https://www.facebook.com/groups/..."
                className="w-full h-11 pl-10 pr-4 bg-[#05070E] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
              />
            </div>
          </div>
        )}

        {showImportDrawer && (
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="leadin-raw-import"
                className="text-xs font-medium text-slate-300"
              >
                Paste Leadin Chrome Extension JSON or copied Facebook / LinkedIn feed text
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload JSON file
                <input
                  type="file"
                  accept=".json,.txt,.html"
                  onChange={handleJsonFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              id="leadin-raw-import"
              rows={4}
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder='Paste copied JSON from the Leadin Chrome Extension or raw social posts here, then press "Start Scrape" to extract into the 6-column sheet and run Gemini AI lead scoring.'
              className="w-full p-3 bg-[#05070E] border border-slate-700/80 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>
        )}

        {validationError && (
          <p className="text-xs text-rose-400" role="alert">
            {validationError}
          </p>
        )}

        {isScraping && scrapeStage && (
          <div className="flex items-center gap-2.5 pt-2 text-xs text-teal-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{scrapeStage}</span>
          </div>
        )}
      </form>
    </motion.section>
  );
};
