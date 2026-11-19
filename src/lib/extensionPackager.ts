import JSZip from 'jszip';

async function renderIconPng(size: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize canvas for extension icon.');
  }

  // Background rounded square
  const radius = Math.round(size * 0.22);
  ctx.fillStyle = '#090D16';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Emerald border
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.stroke();

  // Geometric "L" + upward signal mark
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = Math.max(2, size * 0.13);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.34, size * 0.26);
  ctx.lineTo(size * 0.34, size * 0.72);
  ctx.lineTo(size * 0.70, size * 0.72);
  ctx.stroke();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode extension PNG icon.'));
    }, 'image/png');
  });
}

const MANIFEST_JSON = {
  manifest_version: 3,
  name: 'Leadin — Social Freelance Lead Scraper',
  version: '1.0.0',
  description:
    'Select Facebook, LinkedIn, X, or Reddit plus post date, press Enter to open and scrape freelance work into Excel/PDF or Leadin Web.',
  permissions: ['activeTab', 'tabs', 'scripting', 'storage'],
  host_permissions: [
    'https://www.facebook.com/*',
    'https://www.linkedin.com/*',
    'https://x.com/*',
    'https://twitter.com/*',
    'https://www.reddit.com/*',
  ],
  action: {
    default_popup: 'popup.html',
    default_title: 'Leadin Scraper',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  background: {
    service_worker: 'background.js',
  },
};

const POPUP_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Leadin</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div class="brand">Leadin</div>
        <span class="sub">Freelance Scraper</span>
      </header>

      <form id="scrape-form" class="controls">
        <div class="row">
          <div class="field">
            <label for="platform">Platform</label>
            <select id="platform">
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="x">X / Twitter</option>
              <option value="reddit">Reddit</option>
              <option value="custom">Custom URL</option>
            </select>
          </div>
          <div class="field">
            <label for="dateFilter">Post Date</label>
            <select id="dateFilter">
              <option value="24h">Recent (24h)</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="keywords">Work / Niche Keywords</label>
          <input id="keywords" type="text" placeholder="looking for freelancer, React developer, UI designer" value="looking for freelancer" />
        </div>

        <div class="field hidden" id="custom-url-wrap">
          <label for="customUrl">Target Social URL</label>
          <input id="customUrl" type="url" placeholder="https://www.facebook.com/groups/..." />
        </div>

        <button type="submit" id="start-btn" class="primary-btn">
          Open & Scrape (Enter)
        </button>
      </form>

      <div id="status-bar" class="status-bar">Ready. Choose platform + date and press Enter.</div>

      <div class="table-wrap">
        <table id="leads-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Date</th>
              <th>Work</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody id="leads-body">
            <tr><td colspan="4" class="empty">No scraped leads yet.</td></tr>
          </tbody>
        </table>
      </div>

      <footer class="actions">
        <button id="export-csv" class="sec-btn" type="button">Export Excel (.csv)</button>
        <button id="export-pdf" class="sec-btn" type="button">Print / PDF</button>
        <button id="copy-json" class="sec-btn" type="button">Copy JSON for Web</button>
      </footer>
    </div>
    <script src="popup.js"></script>
  </body>
</html>
`;

const POPUP_CSS = `* { box-sizing: border-box; }
body {
  margin: 0;
  width: 440px;
  min-height: 500px;
  background: #090d16;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
}
.shell { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.topbar { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(148,163,184,0.16); padding-bottom: 10px; }
.brand { font-size: 17px; font-weight: 700; color: #f8fafc; letter-spacing: 0.01em; }
.sub { font-size: 11px; color: #34d399; }
.controls { display: flex; flex-direction: column; gap: 10px; background: #111827; border: 1px solid rgba(148,163,184,0.16); border-radius: 8px; padding: 12px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.hidden { display: none; }
label { font-size: 11px; color: #94a3b8; font-weight: 500; }
select, input {
  background: #090d16;
  color: #f1f5f9;
  border: 1px solid rgba(148,163,184,0.22);
  border-radius: 6px;
  padding: 7px 9px;
  font-size: 12px;
  outline: none;
}
select:focus, input:focus { border-color: #10b981; }
.primary-btn {
  background: #10b981;
  color: #052e16;
  font-weight: 700;
  border: none;
  border-radius: 6px;
  padding: 9px 14px;
  cursor: pointer;
  font-size: 12px;
}
.primary-btn:hover { background: #34d399; }
.status-bar { font-size: 11px; color: #cbd5e1; padding: 6px 8px; background: #111827; border: 1px solid rgba(148,163,184,0.14); border-radius: 6px; }
.table-wrap { max-height: 210px; overflow: auto; border: 1px solid rgba(148,163,184,0.16); border-radius: 8px; background: #111827; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th { text-align: left; padding: 7px 8px; background: #0f172a; color: #94a3b8; border-bottom: 1px solid rgba(148,163,184,0.16); position: sticky; top: 0; }
td { padding: 7px 8px; border-bottom: 1px solid rgba(148,163,184,0.08); vertical-align: top; }
.empty { text-align: center; color: #64748b; padding: 22px 8px; }
.actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.sec-btn {
  background: #111827;
  color: #e2e8f0;
  border: 1px solid rgba(148,163,184,0.22);
  border-radius: 6px;
  padding: 7px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.sec-btn:hover { border-color: #10b981; color: #34d399; }
`;

const BACKGROUND_JS = `function buildTargetUrl({ platform, keywords, dateFilter, customUrl }) {
  const q = encodeURIComponent((keywords || 'looking for freelancer').trim());
  if (platform === 'custom' && customUrl) return customUrl;
  if (platform === 'facebook') return 'https://www.facebook.com/search/posts/?q=' + q;
  if (platform === 'linkedin') {
    const dp = dateFilter === '24h' ? '%22past-24h%22' : dateFilter === '7d' ? '%22past-week%22' : '%22past-month%22';
    return 'https://www.linkedin.com/search/results/content/?keywords=' + q + '&datePosted=' + dp;
  }
  if (platform === 'x') return 'https://x.com/search?q=' + q + '&f=live';
  if (platform === 'reddit') {
    const t = dateFilter === '24h' ? 'day' : dateFilter === '7d' ? 'week' : 'month';
    return 'https://www.reddit.com/r/forhire+freelance_forhire+DesignJobs/search/?q=' + q + '&restrict_sr=1&sort=new&t=' + t;
  }
  return 'https://www.google.com/search?q=' + q;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'LEADIN_START_SCRAPE') {
    const url = buildTargetUrl(msg.payload);
    chrome.tabs.create({ url, active: true }, (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: 'Could not open target tab.' });
        return;
      }
      const tabId = tab.id;
      const listener = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.scripting.executeScript(
              { target: { tabId }, files: ['content.js'] },
              () => {
                chrome.tabs.sendMessage(
                  tabId,
                  { type: 'LEADIN_RUN_DOM_SCRAPE', payload: msg.payload },
                  (res) => {
                    const leads = (res && res.leads) || [];
                    chrome.storage.local.set({ leadinLeads: leads, lastPlatform: msg.payload.platform });
                    chrome.runtime.sendMessage({ type: 'LEADIN_SCRAPE_COMPLETE', leads });
                  }
                );
              }
            );
          }, 2500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      sendResponse({ ok: true, tabId, url });
    });
    return true;
  }
});
`;

const CONTENT_JS = `(() => {
  function extractEmailOrContact(text) {
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
    if (email) return email[0];
    const link = text.match(/https?:\\/\\/[^\\s)]+/);
    if (link) return link[0];
    if (/dm|message me|inbox|comment/i.test(text)) return 'DM / Comment on post';
    return 'View profile link';
  }

  function detectWorkScope(text) {
    const patterns = [
      /(looking for|hiring|need|seeking)\\s+(a|an)?\\s*([^.\\n,]{4,60})/i,
      /(freelance|contract|remote)\\s+([^.\\n,]{4,50})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[0].slice(0, 120);
    }
    return text.split(/\\n|\\./)[0].slice(0, 100) || 'Freelance Opportunity';
  }

  function isFreelanceIntent(text) {
    return /looking for|hiring|freelance|contractor|budget|remote|gig|developer|designer|editor|writer|marketer|agency|need someone/i.test(text);
  }

  async function scrapeCurrentPage(payload) {
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, window.innerHeight * 0.9);
      await new Promise((r) => setTimeout(r, 900));
    }

    const host = location.hostname;
    let nodes = [];
    if (host.includes('linkedin.com')) {
      nodes = Array.from(document.querySelectorAll('.feed-shared-update-v2, .reusable-search__result-container, article'));
    } else if (host.includes('facebook.com')) {
      nodes = Array.from(document.querySelectorAll('[role="article"], [data-pagelet^="FeedUnit"]'));
    } else if (host.includes('x.com') || host.includes('twitter.com')) {
      nodes = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    } else if (host.includes('reddit.com')) {
      nodes = Array.from(document.querySelectorAll('shreddit-post, .Post, [data-testid="post-container"]'));
    } else {
      nodes = Array.from(document.querySelectorAll('article, main section, .post, .card'));
    }

    const results = [];
    const seen = new Set();
    for (const el of nodes) {
      const text = (el.innerText || '').trim();
      if (text.length < 40 || !isFreelanceIntent(text)) continue;

      const anchor = el.querySelector('a[href*="/posts/"], a[href*="/status/"], a[href*="/comments/"], a[href*="http"]');
      const link = anchor ? anchor.href : location.href;
      const key = link + '::' + text.slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);

      const lines = text.split('\\n').map((l) => l.trim()).filter(Boolean);
      const accountName = (el.querySelector('strong, h3, h4, [data-testid="User-Name"]')?.textContent || lines[0] || 'Social Member').trim().slice(0, 120);
      const timeEl = el.querySelector('time');
      const postDate = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent || 'Recent').trim() : (payload.dateFilter || 'Recent');

      results.push({
        accountName,
        date: postDate.slice(0, 40),
        work: detectWorkScope(text),
        post: text.slice(0, 1500),
        link,
        contact: extractEmailOrContact(text),
        platform: payload.platform || 'custom'
      });

      if (results.length >= 30) break;
    }
    return results;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'LEADIN_RUN_DOM_SCRAPE') {
      scrapeCurrentPage(msg.payload || {}).then((leads) => sendResponse({ leads }));
      return true;
    }
  });
})();
`;

const POPUP_JS = `const form = document.getElementById('scrape-form');
const platformEl = document.getElementById('platform');
const dateEl = document.getElementById('dateFilter');
const keywordsEl = document.getElementById('keywords');
const customWrap = document.getElementById('custom-url-wrap');
const customUrlEl = document.getElementById('customUrl');
const statusEl = document.getElementById('status-bar');
const tbody = document.getElementById('leads-body');

let currentLeads = [];

platformEl.addEventListener('change', () => {
  customWrap.classList.toggle('hidden', platformEl.value !== 'custom');
});

function renderLeads(leads) {
  currentLeads = leads || [];
  if (!currentLeads.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">No freelance leads scraped yet.</td></tr>';
    return;
  }
  tbody.innerHTML = currentLeads
    .map(
      (l) =>
        '<tr>' +
        '<td><strong>' + escapeHtml(l.accountName) + '</strong></td>' +
        '<td>' + escapeHtml(l.date) + '</td>' +
        '<td>' + escapeHtml(l.work) + '</td>' +
        '<td>' + escapeHtml(l.contact) + '</td>' +
        '</tr>'
    )
    .join('');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

chrome.storage.local.get(['leadinLeads'], (res) => {
  if (Array.isArray(res.leadinLeads)) renderLeads(res.leadinLeads);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'LEADIN_SCRAPE_COMPLETE') {
    renderLeads(msg.leads);
    statusEl.textContent = 'Captured ' + msg.leads.length + ' freelance leads.';
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const payload = {
    platform: platformEl.value,
    dateFilter: dateEl.value,
    keywords: keywordsEl.value,
    customUrl: customUrlEl.value
  };
  statusEl.textContent = 'Opening ' + payload.platform + ' and scraping freelance posts...';
  chrome.runtime.sendMessage({ type: 'LEADIN_START_SCRAPE', payload }, (res) => {
    if (!res || !res.ok) {
      statusEl.textContent = (res && res.error) || 'Failed to launch tab.';
    }
  });
});

document.getElementById('export-csv').addEventListener('click', () => {
  if (!currentLeads.length) return;
  const headers = ['Account Name', 'Date', 'Work', 'Post', 'Link', 'Contact'];
  const csvRows = [headers.join(',')].concat(
    currentLeads.map((l) =>
      [l.accountName, l.date, l.work, l.post, l.link, l.contact]
        .map((v) => '"' + String(v || '').replace(/"/g, '""') + '"')
        .join(',')
    )
  );
  const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leadin-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('export-pdf').addEventListener('click', () => {
  if (!currentLeads.length) return;
  const w = window.open('', '_blank');
  if (!w) return;
  const rows = currentLeads
    .map(
      (l) =>
        '<tr><td>' +
        escapeHtml(l.accountName) +
        '</td><td>' +
        escapeHtml(l.date) +
        '</td><td>' +
        escapeHtml(l.work) +
        '</td><td>' +
        escapeHtml(l.post.slice(0, 220)) +
        '</td><td>' +
        escapeHtml(l.link) +
        '</td><td>' +
        escapeHtml(l.contact) +
        '</td></tr>'
    )
    .join('');
  w.document.write(
    '<html><head><title>Leadin Leads PDF</title><style>body{font-family:Arial;font-size:11px;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}th{background:#0f172a;color:#fff}</style></head><body><h2>Leadin Scraped Leads</h2><table><thead><tr><th>Account Name</th><th>Date</th><th>Work</th><th>Post</th><th>Link</th><th>Contact</th></tr></thead><tbody>' +
      rows +
      '</tbody></table></body></html>'
  );
  w.document.close();
  w.print();
});

document.getElementById('copy-json').addEventListener('click', async () => {
  if (!currentLeads.length) return;
  await navigator.clipboard.writeText(JSON.stringify(currentLeads, null, 2));
  statusEl.textContent = 'Copied ' + currentLeads.length + ' leads JSON. Paste into Leadin Web to run AI scoring & Gmail alerts.';
});
`;

const README_TXT = `Leadin Chrome Extension (Manifest V3)
=====================================

How to install in Google Chrome / Edge / Brave:
1. Unzip this folder to a permanent directory on your computer.
2. Open chrome://extensions in your browser.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the unzipped folder.

How to use:
1. Click the Leadin icon in your Chrome toolbar.
2. Select Facebook, LinkedIn, X, Reddit, or a Custom URL.
3. Choose Recent (24h), Last 7 Days, or Last 30 Days, enter keywords, and hit Enter.
4. Leadin automatically opens the social platform in a new tab, scrolls the feed, and extracts freelance work into:
   Account Name, Date, Work, Post, Link, Contact.
5. Export directly to Excel (.csv), Print to PDF, or click "Copy JSON for Web" and import into the Leadin Web Workspace for Gemini AI lead scoring and Gmail alerts.
`;

export async function downloadChromeExtensionZip(): Promise<void> {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(MANIFEST_JSON, null, 2));
  zip.file('popup.html', POPUP_HTML);
  zip.file('popup.css', POPUP_CSS);
  zip.file('popup.js', POPUP_JS);
  zip.file('background.js', BACKGROUND_JS);
  zip.file('content.js', CONTENT_JS);
  zip.file('README.txt', README_TXT);

  const [icon16, icon48, icon128] = await Promise.all([
    renderIconPng(16),
    renderIconPng(48),
    renderIconPng(128),
  ]);
  zip.file('icons/icon16.png', icon16);
  zip.file('icons/icon48.png', icon48);
  zip.file('icons/icon128.png', icon128);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leadin-chrome-extension.zip';
  a.click();
  URL.revokeObjectURL(url);
}
