export type SocialPlatform = 'facebook' | 'linkedin' | 'x' | 'reddit' | 'custom';
export type DateFilter = '24h' | '7d' | '30d' | 'custom';
export type LeadStatus = 'new' | 'contacted' | 'archived';
export type ScoreTier = 'high' | 'medium' | 'low';
export type PresetLeadTag = 'hot' | 'cold' | 'long-term' | 'follow-up' | 'vip';

export const PRESET_LEAD_TAGS: PresetLeadTag[] = [
  'hot',
  'long-term',
  'cold',
  'follow-up',
  'vip',
];

export const TAG_META: Record<
  string,
  { label: string; className: string }
> = {
  hot: {
    label: 'Hot',
    className: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
  },
  cold: {
    label: 'Cold',
    className: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  },
  'long-term': {
    label: 'Long-Term',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  },
  'follow-up': {
    label: 'Follow-Up',
    className: 'bg-teal-500/15 text-teal-300 border-teal-500/35',
  },
  vip: {
    label: 'VIP',
    className: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/35',
  },
};

export function getTagStyle(tag: string): { label: string; className: string } {
  const key = tag.toLowerCase();
  if (TAG_META[key]) return TAG_META[key];
  return {
    label: tag,
    className: 'bg-slate-800/90 text-slate-200 border-slate-700',
  };
}

export function normalizeLeadTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24);
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  alertThreshold: number;
  alertRecipient: string;
  defaultKeywords: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CampaignRecord {
  id: string;
  ownerId: string;
  platform: SocialPlatform;
  dateFilter: DateFilter;
  customDate: string;
  keywords: string;
  targetUrl: string;
  status: 'running' | 'completed' | 'failed';
  leadsFoundCount: number;
  highValueCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LeadRecord {
  id: string;
  ownerId: string;
  campaignId: string;
  platform: SocialPlatform;
  accountName: string;
  postDate: string;
  work: string;
  post: string;
  link: string;
  contact: string;
  aiScore: number;
  scoreTier: ScoreTier;
  aiRationale: string;
  suggestedPitch: string;
  alertSent: boolean;
  status: LeadStatus;
  tags?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AlertLogRecord {
  id: string;
  ownerId: string;
  leadIds: string[];
  recipientEmail: string;
  subject: string;
  highValueCount: number;
  gmailMessageId: string;
  sentAt?: unknown;
}

export interface RawScrapedPost {
  accountName: string;
  postDate: string;
  work?: string;
  post: string;
  link: string;
  contact?: string;
  platform?: SocialPlatform;
}

export interface ScoredLeadDraft {
  accountName: string;
  postDate: string;
  work: string;
  post: string;
  link: string;
  contact: string;
  aiScore: number;
  scoreTier: ScoreTier;
  aiRationale: string;
  suggestedPitch: string;
}

export const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; domain: string; searchHint: string }
> = {
  facebook: {
    label: 'Facebook',
    domain: 'facebook.com',
    searchHint: 'Public posts & freelance groups',
  },
  linkedin: {
    label: 'LinkedIn',
    domain: 'linkedin.com',
    searchHint: 'Hiring & freelance contractor posts',
  },
  x: {
    label: 'X / Twitter',
    domain: 'x.com',
    searchHint: 'Real-time client requests',
  },
  reddit: {
    label: 'Reddit',
    domain: 'reddit.com',
    searchHint: 'r/forhire, r/freelance_forhire, r/DesignJobs',
  },
  custom: {
    label: 'Custom Social URL',
    domain: 'web',
    searchHint: 'Threads, IndieHackers, or any public group URL',
  },
};

export const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  '24h': 'Recent (24h)',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  custom: 'Custom Date',
};

/**
 * Clamp and sanitize strings so outgoing Firestore writes strictly satisfy
 * firebase-blueprint.json maxLength constraints.
 */
export function clampStr(value: unknown, maxLen: number, fallback = ''): string {
  const s = typeof value === 'string' ? value.trim() : '';
  const cleaned = s.length > 0 ? s : fallback;
  return cleaned.slice(0, maxLen);
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

export function buildSocialSearchUrl(
  platform: SocialPlatform,
  keywords: string,
  dateFilter: DateFilter,
  customDate: string,
  targetUrl?: string
): string {
  const q = encodeURIComponent(keywords.trim() || 'looking for freelancer');
  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/search/posts/?q=${q}`;
    case 'linkedin':
      return `https://www.linkedin.com/search/results/content/?keywords=${q}&datePosted=${
        dateFilter === '24h' ? '%22past-24h%22' : dateFilter === '7d' ? '%22past-week%22' : '%22past-month%22'
      }`;
    case 'x':
      return `https://x.com/search?q=${q}${customDate ? `%20since%3A${encodeURIComponent(customDate)}` : ''}&f=live`;
    case 'reddit':
      return `https://www.reddit.com/r/forhire+freelance_forhire+DesignJobs/search/?q=${q}&restrict_sr=1&sort=new&t=${
        dateFilter === '24h' ? 'day' : dateFilter === '7d' ? 'week' : 'month'
      }`;
    case 'custom':
      return targetUrl && targetUrl.trim().startsWith('http')
        ? targetUrl.trim()
        : `https://www.google.com/search?q=${q}`;
  }
}
