import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add it in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface RawPostInput {
  accountName: string;
  postDate: string;
  work?: string;
  post: string;
  link: string;
  contact?: string;
}

interface ScoredLeadOutput {
  accountName: string;
  postDate: string;
  work: string;
  post: string;
  link: string;
  contact: string;
  aiScore: number;
  scoreTier: 'high' | 'medium' | 'low';
  aiRationale: string;
  suggestedPitch: string;
}

const SCORED_LEADS_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      accountName: { type: Type.STRING, description: 'Author or company account name.' },
      postDate: { type: Type.STRING, description: 'Post date or relative recency.' },
      work: { type: Type.STRING, description: 'Concise summary of freelance work requested.' },
      post: { type: Type.STRING, description: 'Clean full post text or relevant excerpt.' },
      link: { type: Type.STRING, description: 'Direct post URL.' },
      contact: {
        type: Type.STRING,
        description: 'Extracted email, handle, booking link, or DM instruction.',
      },
      aiScore: {
        type: Type.INTEGER,
        description: 'Freelance prospect quality score from 0 to 100.',
      },
      scoreTier: {
        type: Type.STRING,
        description: 'high (>=80), medium (50-79), or low (<50).',
      },
      aiRationale: {
        type: Type.STRING,
        description: '1-2 sentence rationale covering budget signals, urgency, and clarity.',
      },
      suggestedPitch: {
        type: Type.STRING,
        description: 'Short personalized 2-3 sentence freelance outreach reply.',
      },
    },
    required: [
      'accountName',
      'postDate',
      'work',
      'post',
      'link',
      'contact',
      'aiScore',
      'scoreTier',
      'aiRationale',
      'suggestedPitch',
    ],
  },
};

async function scorePostsWithGemini(
  posts: RawPostInput[],
  platform: string,
  keywords: string
): Promise<ScoredLeadOutput[]> {
  if (posts.length === 0) return [];
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analyze these social media posts from ${platform} (search keywords: "${keywords || 'freelance work'}").
Filter and score each post for genuine freelance hiring / client work potential.

Scoring rubric (0-100):
- 85-100: Explicit freelance/contract budget, urgent timeline, clear deliverables, and direct contact info (email/booking/DM).
- 65-84: Clear freelance hiring request with defined scope, moderate urgency or indirect contact.
- 40-64: Ambiguous need, unpaid/equity-only, or general inquiry.
- 0-39: Self-promotion by another freelancer ("for hire" instead of "hiring"), spam, or unrelated.

Normalize every entry cleanly into:
- accountName, postDate, work (specific freelance role/deliverable), post, link, contact (extract any email/URL/handle or state how to reply), aiScore (integer 0-100), scoreTier ("high" | "medium" | "low"), aiRationale, suggestedPitch.

Posts JSON:
${JSON.stringify(posts.slice(0, 20), null, 2)}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        'You are a B2B freelance lead qualification analyst. Return valid JSON matching the schema.',
      responseMimeType: 'application/json',
      responseSchema: SCORED_LEADS_SCHEMA,
    },
  });

  const text = (response.text ?? '[]').trim();
  const parsed = JSON.parse(text) as ScoredLeadOutput[];
  return parsed.map((item) => {
    const score = Math.max(0, Math.min(100, Math.round(Number(item.aiScore) || 50)));
    const scoreTier: 'high' | 'medium' | 'low' =
      score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
    return {
      ...item,
      aiScore: score,
      scoreTier,
    };
  });
}

async function fetchRedditPosts(keywords: string, dateFilter: string): Promise<RawPostInput[]> {
  const t = dateFilter === '24h' ? 'day' : dateFilter === '7d' ? 'week' : 'month';
  const q = encodeURIComponent(keywords.trim() || 'hiring');
  const url = `https://www.reddit.com/r/forhire+freelance_forhire+DesignJobs+hiring/search.json?q=${q}&restrict_sr=1&sort=new&t=${t}&limit=15`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LeadinScraper/1.0 (+https://leadin.app)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) {
    throw new Error(`Reddit returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: {
      children?: Array<{
        data: {
          author?: string;
          created_utc?: number;
          title?: string;
          selftext?: string;
          permalink?: string;
        };
      }>;
    };
  };

  const children = data.data?.children ?? [];
  return children
    .filter((c) => {
      const title = c.data.title || '';
      // Prefer [Hiring] posts over [For Hire]
      return !/\[for hire\]/i.test(title);
    })
    .slice(0, 12)
    .map((c) => {
      const d = c.data;
      const body = `${d.title || ''}\n\n${d.selftext || ''}`.trim();
      const emailMatch = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      return {
        accountName: d.author ? `u/${d.author}` : 'Reddit User',
        postDate: d.created_utc
          ? new Date(d.created_utc * 1000).toISOString().slice(0, 10)
          : 'Recent',
        work: (d.title || 'Freelance Project').replace(/^\[hiring\]\s*/i, '').slice(0, 140),
        post: body.slice(0, 2000),
        link: d.permalink ? `https://www.reddit.com${d.permalink}` : 'https://www.reddit.com/r/forhire',
        contact: emailMatch ? emailMatch[0] : `Reddit DM u/${d.author || 'author'}`,
      };
    });
}

async function discoverSocialPostsViaGeminiSearch(params: {
  platform: string;
  dateFilter: string;
  customDate: string;
  keywords: string;
  targetUrl?: string;
}): Promise<{ posts: RawPostInput[]; groundedSources: Array<{ title: string; uri: string }> }> {
  const ai = getGeminiClient();

  const siteFilter =
    params.platform === 'linkedin'
      ? 'site:linkedin.com/posts OR site:linkedin.com/feed'
      : params.platform === 'facebook'
      ? 'site:facebook.com/groups OR site:facebook.com'
      : params.platform === 'x'
      ? 'site:x.com OR site:twitter.com'
      : params.platform === 'reddit'
      ? 'site:reddit.com/r/forhire OR site:reddit.com/r/freelance_forhire'
      : params.targetUrl
      ? `site:${new URL(params.targetUrl).hostname}`
      : '';

  const recencyPhrase =
    params.dateFilter === '24h'
      ? 'posted in the last 24 hours'
      : params.dateFilter === '7d'
      ? 'posted in the past 7 days'
      : params.dateFilter === '30d'
      ? 'posted in the past 30 days'
      : params.customDate
      ? `posted since ${params.customDate}`
      : 'recent posts';

  const queryText = `Find real recent public freelance hiring or client project posts on ${params.platform} (${siteFilter}) ${recencyPhrase} matching "${
    params.keywords || 'looking for freelance developer designer'
  }".
For each real post found via Google Search, summarize:
1) Author / Account Name
2) Post Date
3) Requested Freelance Work
4) Post Excerpt
5) Exact URL from search results
6) Contact method (email, application link, or DM instruction).
Only include real posts grounded in search results.`;

  const groundedResp = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: queryText,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = groundedResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const groundedSources = chunks
    .map((c) => c.web)
    .filter((w): w is { uri: string; title: string } => Boolean(w?.uri))
    .map((w) => ({ title: w.title || 'Source Post', uri: w.uri }));

  const structuredResp = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Extract the discovered freelance posts below into structured JSON records. Pair each record with its exact matching URL from the grounded sources list whenever available. If no genuine hiring posts were found, return an empty array [].

Discovered summary:
${groundedResp.text || ''}

Grounded source URLs:
${JSON.stringify(groundedSources, null, 2)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            accountName: { type: Type.STRING },
            postDate: { type: Type.STRING },
            work: { type: Type.STRING },
            post: { type: Type.STRING },
            link: { type: Type.STRING },
            contact: { type: Type.STRING },
          },
          required: ['accountName', 'postDate', 'work', 'post', 'link', 'contact'],
        },
      },
    },
  });

  const parsed = JSON.parse((structuredResp.text ?? '[]').trim()) as RawPostInput[];
  return { posts: parsed, groundedSources };
}

async function parseRawContentWithGemini(
  rawContent: string,
  platform: string
): Promise<RawPostInput[]> {
  const ai = getGeminiClient();

  const resp = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Extract individual freelance hiring posts from the following pasted ${platform} feed text, HTML, or Chrome Extension capture into structured records. Ignore unrelated navigation chrome.

Raw content:
${rawContent.slice(0, 24000)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            accountName: { type: Type.STRING },
            postDate: { type: Type.STRING },
            work: { type: Type.STRING },
            post: { type: Type.STRING },
            link: { type: Type.STRING },
            contact: { type: Type.STRING },
          },
          required: ['accountName', 'postDate', 'work', 'post', 'link', 'contact'],
        },
      },
    },
  });

  return JSON.parse((resp.text ?? '[]').trim()) as RawPostInput[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/scrape', async (req, res) => {
    try {
      const {
        platform = 'linkedin',
        dateFilter = '7d',
        customDate = '',
        keywords = 'looking for freelancer',
        targetUrl = '',
        rawContent = '',
      } = req.body as {
        platform?: string;
        dateFilter?: string;
        customDate?: string;
        keywords?: string;
        targetUrl?: string;
        rawContent?: string;
      };

      let rawPosts: RawPostInput[] = [];
      let sourceMethod = 'web-discovery';
      let groundedSources: Array<{ title: string; uri: string }> = [];

      // 1. If rawContent (JSON array from Chrome Extension or pasted social feed) is provided:
      if (rawContent && rawContent.trim().length > 0) {
        sourceMethod = 'extension-or-paste';
        try {
          const maybeJson = JSON.parse(rawContent);
          if (Array.isArray(maybeJson)) {
            rawPosts = maybeJson.map((item) => ({
              accountName: String(item.accountName || item['Account Name'] || 'Social User'),
              postDate: String(item.postDate || item.date || item.Date || 'Recent'),
              work: String(item.work || item.Work || ''),
              post: String(item.post || item.Post || ''),
              link: String(item.link || item.Link || ''),
              contact: String(item.contact || item.Contact || ''),
            }));
          } else {
            rawPosts = await parseRawContentWithGemini(rawContent, platform);
          }
        } catch {
          rawPosts = await parseRawContentWithGemini(rawContent, platform);
        }
      } else if (platform === 'reddit') {
        // 2. Direct live public Reddit JSON API, falling back to Gemini Search Grounding
        try {
          rawPosts = await fetchRedditPosts(keywords, dateFilter);
          sourceMethod = 'reddit-live-api';
        } catch {
          const discovered = await discoverSocialPostsViaGeminiSearch({
            platform,
            dateFilter,
            customDate,
            keywords,
            targetUrl,
          });
          rawPosts = discovered.posts;
          groundedSources = discovered.groundedSources;
          sourceMethod = 'search-grounding';
        }
      } else if (platform === 'custom' && targetUrl && targetUrl.startsWith('http')) {
        // 3. Direct fetch of public custom URL, falling back to search grounding
        try {
          const pageRes = await fetch(targetUrl, {
            headers: { 'User-Agent': 'LeadinScraper/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          if (pageRes.ok) {
            const text = await pageRes.text();
            rawPosts = await parseRawContentWithGemini(text, 'custom');
            sourceMethod = 'direct-url-fetch';
          }
        } catch {
          // fall through to search grounding
        }
        if (rawPosts.length === 0) {
          const discovered = await discoverSocialPostsViaGeminiSearch({
            platform,
            dateFilter,
            customDate,
            keywords,
            targetUrl,
          });
          rawPosts = discovered.posts;
          groundedSources = discovered.groundedSources;
          sourceMethod = 'search-grounding';
        }
      } else {
        // 4. LinkedIn / Facebook / X public discovery via Gemini Google Search Grounding
        const discovered = await discoverSocialPostsViaGeminiSearch({
          platform,
          dateFilter,
          customDate,
          keywords,
          targetUrl,
        });
        rawPosts = discovered.posts;
        groundedSources = discovered.groundedSources;
        sourceMethod = 'search-grounding';
      }

      const scoredLeads = await scorePostsWithGemini(rawPosts, platform, keywords);
      res.json({
        leads: scoredLeads,
        sourceMethod,
        groundedSources,
      });
    } catch (err) {
      console.error('Scrape error:', err);
      const message = err instanceof Error ? err.message : 'Failed to scrape and score leads.';
      const status = message.includes('GEMINI_API_KEY') ? 500 : 502;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/score', async (req, res) => {
    try {
      const { posts = [], platform = 'custom', keywords = '' } = req.body as {
        posts?: RawPostInput[];
        platform?: string;
        keywords?: string;
      };
      if (!Array.isArray(posts) || posts.length === 0) {
        return res.status(400).json({ error: 'Provide at least one post to score.' });
      }
      const scoredLeads = await scorePostsWithGemini(posts, platform, keywords);
      res.json({ leads: scoredLeads });
    } catch (err) {
      console.error('AI score error:', err);
      const message = err instanceof Error ? err.message : 'AI lead scoring failed.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leadin server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
