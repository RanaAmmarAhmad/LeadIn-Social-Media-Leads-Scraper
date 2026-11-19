/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Menu,
  Pause,
  Play,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  createCampaignDoc,
  deleteLeadDoc,
  ensureUserProfile,
  finalizeCampaignDoc,
  getGmailAccessToken,
  googleSignIn,
  initAuth,
  logout,
  recordAlertSent,
  saveScoredLeadsToCampaign,
  subscribeAlertLogs,
  subscribeCampaigns,
  subscribeLeads,
  subscribeUserProfile,
  updateLeadStatus,
  updateLeadTags,
  updateUserProfileSettings,
} from './lib/firebase';
import { buildProspectAlertEmail, sendGmailAlert } from './lib/gmail';
import { downloadChromeExtensionZip } from './lib/extensionPackager';
import {
  PLATFORM_META,
  type AlertLogRecord,
  type CampaignRecord,
  type LeadRecord,
  type LeadStatus,
  type ScoredLeadDraft,
  type UserProfile,
} from './types/leadin';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import {
  CommandLauncher,
  type ScrapeLaunchPayload,
} from './components/CommandLauncher';
import { LeadTable } from './components/LeadTable';
import { LeadInspector } from './components/LeadInspector';
import { AlertsView } from './components/AlertsView';
import { ExtensionStudio } from './components/ExtensionStudio';
import { GmailConfirmModal } from './components/GmailConfirmModal';
import { SpatialBackdrop3D } from './components/SpatialBackdrop3D';
import { SpatialCard } from './components/SpatialCard';

interface ToastState {
  tone: 'success' | 'error';
  message: string;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLogRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('console');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // 3D Spatial Stage controls
  const [stageShowcase, setStageShowcase] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);

  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStage, setScrapeStage] = useState('');
  const [groundedSources, setGroundedSources] = useState<
    Array<{ title: string; uri: string }>
  >([]);

  const [pendingAlertLeads, setPendingAlertLeads] = useState<LeadRecord[]>([]);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (tone: 'success' | 'error', message: string) => {
    setToast({ tone, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    const unsub = initAuth((nextUser, token) => {
      setUser(nextUser);
      setGmailToken(token);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCampaigns([]);
      setLeads([]);
      setAlertLogs([]);
      return;
    }

    let cancelled = false;
    setLoadingData(true);

    void ensureUserProfile(user).catch((err) => {
      if (!cancelled) {
        showToast('error', err instanceof Error ? err.message : 'Failed to initialize profile.');
      }
    });

    const unsubProfile = subscribeUserProfile(
      user.uid,
      (p) => setProfile(p),
      (err) => showToast('error', err.message)
    );
    const unsubCampaigns = subscribeCampaigns(
      user.uid,
      (c) => setCampaigns(c),
      (err) => showToast('error', err.message)
    );
    const unsubLeads = subscribeLeads(
      user.uid,
      (l) => {
        setLeads(l);
        setLoadingData(false);
      },
      (err) => {
        setLoadingData(false);
        showToast('error', err.message);
      }
    );
    const unsubLogs = subscribeAlertLogs(
      user.uid,
      (logs) => setAlertLogs(logs),
      (err) => showToast('error', err.message)
    );

    return () => {
      cancelled = true;
      unsubProfile();
      unsubCampaigns();
      unsubLeads();
      unsubLogs();
    };
  }, [user]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setGmailToken(res.accessToken);
      showToast(
        'success',
        res.accessToken
          ? 'Signed in with Google and Gmail alerts connected.'
          : 'Signed in with Google.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(msg);
      showToast('error', msg);
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setGmailToken(null);
    setSelectedLeadId(null);
    setSelectedCampaignId(null);
    setStageShowcase(false);
  };

  const alertThreshold = profile?.alertThreshold ?? 80;
  const recipientEmail = profile?.alertRecipient || user?.email || '';

  const visibleLeads = useMemo(() => {
    if (!selectedCampaignId) return leads;
    return leads.filter((l) => l.campaignId === selectedCampaignId);
  }, [leads, selectedCampaignId]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const pendingHighValueLeads = useMemo(
    () => leads.filter((l) => l.aiScore >= alertThreshold && !l.alertSent),
    [leads, alertThreshold]
  );

  const hotLeadsCount = useMemo(
    () => leads.filter((l) => (l.tags ?? []).includes('hot')).length,
    [leads]
  );

  const avgScore = useMemo(() => {
    if (leads.length === 0) return 0;
    const sum = leads.reduce((acc, l) => acc + l.aiScore, 0);
    return Math.round(sum / leads.length);
  }, [leads]);

  const handleLaunchScrape = async (payload: ScrapeLaunchPayload) => {
    if (!user) return;
    setIsScraping(true);
    setGroundedSources([]);
    setScrapeStage(
      `Scanning ${PLATFORM_META[payload.platform].label} (${payload.dateFilter}) for freelance work...`
    );

    let campaignId: string | null = null;
    try {
      campaignId = await createCampaignDoc({
        ownerId: user.uid,
        platform: payload.platform,
        dateFilter: payload.dateFilter,
        customDate: payload.customDate,
        keywords: payload.keywords,
        targetUrl: payload.targetUrl,
      });

      setScrapeStage('Extracting 6-column fields and computing Gemini AI lead scores...');
      const resp = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await resp.json()) as {
        leads?: ScoredLeadDraft[];
        groundedSources?: Array<{ title: string; uri: string }>;
        error?: string;
      };

      if (!resp.ok) {
        throw new Error(data.error || `Scrape failed (${resp.status}).`);
      }

      const scored = Array.isArray(data.leads) ? data.leads : [];
      if (Array.isArray(data.groundedSources)) {
        setGroundedSources(data.groundedSources);
      }

      if (scored.length === 0) {
        await finalizeCampaignDoc(campaignId, 'completed', 0, 0);
        showToast(
          'error',
          'No matching public freelance posts were found for this query. Try broader keywords, Reddit, or paste/import from the Chrome Extension.'
        );
        return;
      }

      setScrapeStage(`Saving ${scored.length} scored leads to cloud workspace...`);
      const saved = await saveScoredLeadsToCampaign({
        ownerId: user.uid,
        campaignId,
        platform: payload.platform,
        leads: scored,
      });

      const highValueSaved = saved.filter((l) => l.aiScore >= alertThreshold);
      await finalizeCampaignDoc(
        campaignId,
        'completed',
        saved.length,
        highValueSaved.length
      );

      setSelectedCampaignId(null);
      showToast(
        'success',
        `Captured ${saved.length} freelance lead${saved.length === 1 ? '' : 's'} (${highValueSaved.length} high-value ${alertThreshold}+).`
      );
    } catch (err) {
      if (campaignId) {
        void finalizeCampaignDoc(campaignId, 'failed', 0, 0).catch(() => {});
      }
      showToast(
        'error',
        err instanceof Error ? err.message : 'Failed to complete scrape run.'
      );
    } finally {
      setIsScraping(false);
      setScrapeStage('');
    }
  };

  const handleOpenAlertModal = (targetLeads: LeadRecord[]) => {
    if (targetLeads.length === 0) return;
    setPendingAlertLeads(targetLeads);
    setAlertModalOpen(true);
  };

  const emailPreview = useMemo(
    () => buildProspectAlertEmail(pendingAlertLeads, recipientEmail),
    [pendingAlertLeads, recipientEmail]
  );

  const handleConfirmSendGmail = async () => {
    if (!user || pendingAlertLeads.length === 0) return;
    const token = gmailToken || getGmailAccessToken();
    if (!token) {
      showToast('error', 'Reconnect Google Sign-In to authorize Gmail sending.');
      return;
    }

    setSendingAlert(true);
    try {
      const sent = await sendGmailAlert({
        accessToken: token,
        to: recipientEmail,
        subject: emailPreview.subject,
        htmlBody: emailPreview.htmlBody,
        textBody: emailPreview.textBody,
      });

      await recordAlertSent({
        ownerId: user.uid,
        leadIds: pendingAlertLeads.map((l) => l.id),
        recipientEmail,
        subject: emailPreview.subject,
        gmailMessageId: sent.id,
      });

      setAlertModalOpen(false);
      setPendingAlertLeads([]);
      showToast('success', `Gmail alert sent to ${recipientEmail}.`);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Failed to send Gmail alert.'
      );
    } finally {
      setSendingAlert(false);
    }
  };

  const handleUpdateStatus = async (leadId: string, status: LeadStatus) => {
    try {
      await updateLeadStatus(leadId, status);
      showToast('success', `Lead marked as ${status}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update lead.');
    }
  };

  const handleUpdateTags = async (leadId: string, tags: string[]) => {
    try {
      await updateLeadTags(leadId, tags);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update lead tags.');
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      await deleteLeadDoc(leadId);
      showToast('success', 'Lead removed from workspace.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not remove lead.');
    }
  };

  const handleSaveSettings = async (updates: {
    displayName: string;
    alertThreshold: number;
    alertRecipient: string;
    defaultKeywords: string;
  }) => {
    if (!user) return;
    try {
      await updateUserProfileSettings(user.uid, updates);
      showToast('success', 'Alert rules synced to cloud.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save rules.');
    }
  };

  const tabTitleMap: Record<WorkspaceTab, string> = {
    console: 'Scrape Console',
    leads: 'Lead Sheet',
    alerts: 'Gmail Alerts',
    extension: 'Chrome Extension',
  };

  const stageMode = !user || stageShowcase ? 'showcase' : 'ambient';

  return (
    <div className="min-h-screen bg-[#05070E] text-slate-100 relative overflow-x-hidden">
      {/* Persistent Three.js 3D Kinetic Lead Prism Core */}
      <SpatialBackdrop3D
        isScraping={isScraping}
        hotLeadCount={hotLeadsCount}
        totalLeadCount={leads.length}
        stageMode={stageMode}
        motionEnabled={motionEnabled}
      />

      {!authReady ? (
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-sm font-mono text-slate-300">
            Initializing Leadin 3D workspace...
          </div>
        </div>
      ) : !user ? (
        /* Unauthenticated 3D Spatial Landing & Sign-In */
        <div className="relative z-10 min-h-screen flex flex-col">
          <header className="h-16 px-6 lg:px-10 border-b border-slate-800/70 bg-[#05070E]/85 flex items-center justify-between gap-8">
            <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
              Leadin
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setMotionEnabled((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-800 text-slate-300 hover:border-teal-400/50 hover:text-teal-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                {motionEnabled ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {motionEnabled ? 'Pause 3D' : 'Resume 3D'}
              </button>
              <button
                type="button"
                onClick={() => void downloadChromeExtensionZip()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Chrome Extension
              </button>
            </div>
          </header>

          <main className="flex-1 flex items-center px-6 lg:px-12 py-10 max-w-[1440px] w-full mx-auto">
            <div className="max-w-xl w-full perspective-stage">
              <SpatialCard tilt maxTilt={3.5} className="rounded-2xl p-8 space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-teal-300">
                    Spatial Freelance Scraper · AI Lead Scoring · Gmail Alerts
                  </p>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-100 leading-tight [text-wrap:balance]">
                    Capture high-value freelance work across social feeds in 3D motion.
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Select Facebook, LinkedIn, X, Reddit, or any social URL, pick a post date, and hit Enter to scrape opportunities into the 6-column spreadsheet format (Account Name, Date, Work, Post, Link, Contact), tag prospects as Hot, Cold, or Long-Term, export Excel or PDF, and dispatch Gmail alerts.
                  </p>
                </div>

                <div className="pt-1 space-y-3">
                  <GoogleSignInButton
                    onClick={handleGoogleLogin}
                    disabled={signingIn}
                    label={signingIn ? 'Connecting Google...' : 'Sign in with Google'}
                  />
                  {authError && (
                    <p className="text-xs text-rose-400" role="alert">
                      {authError}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Google Sign-In syncs tagged leads in the cloud and authorizes confirmed Gmail alerts.
                  </p>
                </div>

                <div className="pt-5 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-100">6-Column Export</div>
                    <div className="text-slate-400 mt-0.5">Excel (.xlsx) & PDF</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">Lead Tagging</div>
                    <div className="text-slate-400 mt-0.5">Hot · Cold · Long-Term</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">Chrome Extension</div>
                    <div className="text-slate-400 mt-0.5">Manifest V3 ZIP</div>
                  </div>
                </div>
              </SpatialCard>
            </div>
          </main>
        </div>
      ) : stageShowcase ? (
        /* Unobstructed 3D Spatial Showcase View with Collapsible Bottom Dock */
        <div className="relative z-10 min-h-screen pointer-events-none flex flex-col justify-between p-6">
          <div className="pointer-events-auto flex items-center justify-between">
            <div className="spatial-panel rounded-xl px-4 py-2.5 flex items-center gap-3">
              <Box className="w-4 h-4 text-teal-300" />
              <div>
                <div className="font-display text-sm font-bold text-slate-100">
                  Leadin Kinetic Core
                </div>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {leads.length} leads · {hotLeadsCount} hot · avg {avgScore}/100
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Bottom Control Dock */}
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center max-w-[min(680px,94vw)] w-full">
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#080C17]/95 border border-slate-700/80 text-xs text-slate-300 hover:text-teal-300 cursor-pointer"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show Controls
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Hide Controls
                </>
              )}
            </button>

            {!dockCollapsed && (
              <div className="spatial-panel rounded-2xl px-4 py-3 w-full flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                  <span className="text-teal-300">{leads.length} Total</span>
                  <span className="text-rose-300">{hotLeadsCount} Hot</span>
                  <span className="text-amber-300">{pendingHighValueLeads.length} Unalerted</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMotionEnabled((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-200 hover:border-teal-400 cursor-pointer whitespace-nowrap"
                  >
                    {motionEnabled ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {motionEnabled ? 'Pause Motion' : 'Resume Motion'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageShowcase(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 cursor-pointer whitespace-nowrap"
                  >
                    Return to Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Main Authenticated Spatial Dashboard */
        <div className="relative z-10 min-h-screen flex">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            user={user}
            gmailConnected={Boolean(gmailToken)}
            onReconnectGmail={handleGoogleLogin}
            onLogout={handleLogout}
            campaigns={campaigns}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
            totalLeads={leads.length}
            hotLeadsCount={hotLeadsCount}
            pendingHighValueCount={pendingHighValueLeads.length}
            mobileOpen={mobileNavOpen}
            onCloseMobile={() => setMobileNavOpen(false)}
          />

          <div className="flex-1 min-w-0 flex flex-col">
            {/* Top Bar Contract: Breadcrumb left, clean single-line actions right */}
            <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80 bg-[#05070E]/90 sticky top-0 z-30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                  className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-sm truncate">
                  <span className="text-slate-500">Leadin</span>
                  <span className="text-slate-600">/</span>
                  <span className="font-display font-semibold text-slate-100 truncate">
                    {tabTitleMap[activeTab]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setStageShowcase(true)}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-800 bg-[#0B101D] text-slate-300 hover:border-teal-400/50 hover:text-teal-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Box className="w-3.5 h-3.5 text-teal-300" />
                  3D Stage
                </button>
                {pendingHighValueLeads.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAlertModal(pendingHighValueLeads)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Send Gmail Alert ({pendingHighValueLeads.length})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('extension')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Get Extension
                  </button>
                )}
              </div>
            </header>

            {/* Main Viewport */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 perspective-stage">
              {(activeTab === 'console' || activeTab === 'leads') && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <SpatialCard delay={0} className="rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Total Scraped Leads</div>
                    <div className="font-mono text-2xl font-semibold text-slate-100 tabular-nums mt-1">
                      {leads.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Across {campaigns.length} scrape run{campaigns.length === 1 ? '' : 's'}
                    </div>
                  </SpatialCard>

                  <SpatialCard delay={0.05} className="rounded-2xl p-4">
                    <div className="text-xs text-slate-400">
                      High-Value ({alertThreshold}+)
                    </div>
                    <div className="font-mono text-2xl font-semibold text-teal-300 tabular-nums mt-1">
                      {leads.filter((l) => l.aiScore >= alertThreshold).length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {pendingHighValueLeads.length} awaiting Gmail alert
                    </div>
                  </SpatialCard>

                  <SpatialCard delay={0.1} className="rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Hot Tagged Prospects</div>
                    <div className="font-mono text-2xl font-semibold text-rose-300 tabular-nums mt-1">
                      {hotLeadsCount}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Avg AI score {avgScore}/100
                    </div>
                  </SpatialCard>

                  <SpatialCard delay={0.15} className="rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Gmail Alerts Sent</div>
                    <div className="font-mono text-2xl font-semibold text-amber-300 tabular-nums mt-1">
                      {alertLogs.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {gmailToken ? 'Gmail connected' : 'Reconnect to send'}
                    </div>
                  </SpatialCard>
                </div>
              )}

              <AnimatePresence mode="wait">
                {activeTab === 'console' && (
                  <motion.div
                    key="tab-console"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <CommandLauncher
                      defaultKeywords={
                        profile?.defaultKeywords || 'looking for freelance developer designer'
                      }
                      isScraping={isScraping}
                      scrapeStage={scrapeStage}
                      onLaunchScrape={handleLaunchScrape}
                    />

                    {groundedSources.length > 0 && (
                      <div className="spatial-panel rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        <span className="text-slate-400 font-medium">
                          Verified Search Sources:
                        </span>
                        {groundedSources.slice(0, 6).map((src, idx) => (
                          <a
                            key={`${src.uri}-${idx}`}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-teal-300 hover:text-teal-200 hover:underline max-w-[220px] truncate"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}

                    <LeadTable
                      leads={visibleLeads}
                      loading={loadingData}
                      selectedLeadId={selectedLeadId}
                      onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                      onUpdateTags={handleUpdateTags}
                      onTriggerAlertForLeads={handleOpenAlertModal}
                      alertThreshold={alertThreshold}
                      activeCampaignLabel={
                        selectedCampaign
                          ? `${PLATFORM_META[selectedCampaign.platform]?.label} · ${selectedCampaign.keywords || 'All'}`
                          : null
                      }
                      onClearCampaignFilter={() => setSelectedCampaignId(null)}
                    />
                  </motion.div>
                )}

                {activeTab === 'leads' && (
                  <motion.div
                    key="tab-leads"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LeadTable
                      leads={visibleLeads}
                      loading={loadingData}
                      selectedLeadId={selectedLeadId}
                      onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                      onUpdateTags={handleUpdateTags}
                      onTriggerAlertForLeads={handleOpenAlertModal}
                      alertThreshold={alertThreshold}
                      activeCampaignLabel={
                        selectedCampaign
                          ? `${PLATFORM_META[selectedCampaign.platform]?.label} · ${selectedCampaign.keywords || 'All'}`
                          : null
                      }
                      onClearCampaignFilter={() => setSelectedCampaignId(null)}
                    />
                  </motion.div>
                )}

                {activeTab === 'alerts' && (
                  <motion.div
                    key="tab-alerts"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AlertsView
                      profile={profile}
                      leads={leads}
                      alertLogs={alertLogs}
                      gmailConnected={Boolean(gmailToken)}
                      onReconnectGmail={handleGoogleLogin}
                      onSaveSettings={handleSaveSettings}
                      onTriggerAlertForLeads={handleOpenAlertModal}
                      onSelectLead={(lead) => setSelectedLeadId(lead.id)}
                    />
                  </motion.div>
                )}

                {activeTab === 'extension' && (
                  <motion.div
                    key="tab-extension"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ExtensionStudio
                      recentLeads={leads}
                      isScraping={isScraping}
                      onRunPopupScrape={handleLaunchScrape}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        </div>
      )}

      {/* Prospect Inspector Drawer */}
      <LeadInspector
        lead={selectedLead}
        alertThreshold={alertThreshold}
        onClose={() => setSelectedLeadId(null)}
        onUpdateStatus={handleUpdateStatus}
        onUpdateTags={handleUpdateTags}
        onDeleteLead={handleDeleteLead}
        onSendAlert={(lead) => handleOpenAlertModal([lead])}
      />

      {/* Explicit Gmail Send Confirmation Modal */}
      <GmailConfirmModal
        open={alertModalOpen}
        leads={pendingAlertLeads}
        recipientEmail={recipientEmail}
        subject={emailPreview.subject}
        gmailConnected={Boolean(gmailToken)}
        sending={sendingAlert}
        onReconnectGmail={handleGoogleLogin}
        onConfirmSend={handleConfirmSendGmail}
        onCancel={() => {
          setAlertModalOpen(false);
          setPendingAlertLeads([]);
        }}
      />

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-3 shadow-2xl ${
            toast.tone === 'success'
              ? 'bg-[#081A1A] border-teal-400/40 text-teal-100'
              : 'bg-[#201016] border-rose-500/45 text-rose-100'
          }`}
        >
          {toast.tone === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0" />
          )}
          <span className="leading-relaxed">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
