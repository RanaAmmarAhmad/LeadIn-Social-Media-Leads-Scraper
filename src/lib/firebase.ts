import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  clampInt,
  clampStr,
  normalizeLeadTag,
  type AlertLogRecord,
  type CampaignRecord,
  type DateFilter,
  type LeadRecord,
  type LeadStatus,
  type ScoredLeadDraft,
  type ScoreTier,
  type SocialPlatform,
  type UserProfile,
} from '../types/leadin';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.setCustomParameters({ prompt: 'select_account' });

// Strictly cache OAuth access token in memory only (never localStorage/sessionStorage)
let isSigningIn = false;
let cachedGmailAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory startup connectivity check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: Firestore client is offline.');
    }
  }
}
void testConnection();

export function initAuth(
  onUserChanged: (user: User | null, gmailToken: string | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedGmailAccessToken = null;
      onUserChanged(null, null);
    } else if (!isSigningIn) {
      onUserChanged(user, cachedGmailAccessToken);
    }
  });
}

export async function googleSignIn(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedGmailAccessToken = credential?.accessToken ?? null;
    return {
      user: result.user,
      accessToken: cachedGmailAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export async function logout(): Promise<void> {
  cachedGmailAccessToken = null;
  await signOut(auth);
}

export function generateSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const profile: UserProfile = {
      uid: user.uid,
      email: clampStr(user.email, 254, 'user@example.com'),
      displayName: clampStr(user.displayName, 120, 'Leadin User'),
      alertThreshold: 80,
      alertRecipient: clampStr(user.email, 254, 'user@example.com'),
      defaultKeywords: 'looking for freelance developer designer',
    };
    await setDoc(ref, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileSettings(
  uid: string,
  updates: Pick<UserProfile, 'displayName' | 'alertThreshold' | 'alertRecipient' | 'defaultKeywords'>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clampStr(updates.displayName, 120, 'Leadin User'),
      alertThreshold: clampInt(updates.alertThreshold, 0, 100, 80),
      alertRecipient: clampStr(updates.alertRecipient, 254, 'user@example.com'),
      defaultKeywords: clampStr(updates.defaultKeywords, 200, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeCampaigns(
  uid: string,
  onData: (campaigns: CampaignRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'campaigns';
  const q = query(
    collection(db, 'campaigns'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CampaignRecord, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeLeads(
  uid: string,
  onData: (leads: LeadRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'leads';
  const q = query(
    collection(db, 'leads'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LeadRecord, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeAlertLogs(
  uid: string,
  onData: (logs: AlertLogRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'alertLogs';
  const q = query(
    collection(db, 'alertLogs'),
    where('ownerId', '==', uid),
    orderBy('sentAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AlertLogRecord, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createCampaignDoc(params: {
  ownerId: string;
  platform: SocialPlatform;
  dateFilter: DateFilter;
  customDate: string;
  keywords: string;
  targetUrl: string;
}): Promise<string> {
  const campaignId = generateSafeId('camp');
  const path = `campaigns/${campaignId}`;
  try {
    await setDoc(doc(db, 'campaigns', campaignId), {
      ownerId: params.ownerId,
      platform: params.platform,
      dateFilter: params.dateFilter,
      customDate: clampStr(params.customDate, 40, ''),
      keywords: clampStr(params.keywords, 200, ''),
      targetUrl: clampStr(params.targetUrl, 500, ''),
      status: 'running',
      leadsFoundCount: 0,
      highValueCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return campaignId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function finalizeCampaignDoc(
  campaignId: string,
  status: 'completed' | 'failed',
  leadsFoundCount: number,
  highValueCount: number
): Promise<void> {
  const path = `campaigns/${campaignId}`;
  try {
    await updateDoc(doc(db, 'campaigns', campaignId), {
      status,
      leadsFoundCount: clampInt(leadsFoundCount, 0, 1000, 0),
      highValueCount: clampInt(highValueCount, 0, 1000, 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveScoredLeadsToCampaign(params: {
  ownerId: string;
  campaignId: string;
  platform: SocialPlatform;
  leads: ScoredLeadDraft[];
}): Promise<LeadRecord[]> {
  const batch = writeBatch(db);
  const saved: LeadRecord[] = [];
  const slice = params.leads.slice(0, 50);

  for (const item of slice) {
    const leadId = generateSafeId('lead');
    const score = clampInt(item.aiScore, 0, 100, 50);
    const scoreTier: ScoreTier = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
    const initialTag = score >= 85 ? 'hot' : score >= 60 ? 'long-term' : 'cold';
    const payload = {
      ownerId: params.ownerId,
      campaignId: params.campaignId,
      platform: params.platform,
      accountName: clampStr(item.accountName, 160, 'Unknown Account'),
      postDate: clampStr(item.postDate, 60, 'Recent'),
      work: clampStr(item.work, 200, 'Freelance Project'),
      post: clampStr(item.post, 4000, 'No post content extracted.'),
      link: clampStr(item.link, 1000, ''),
      contact: clampStr(item.contact, 300, 'Reply / DM on platform'),
      aiScore: score,
      scoreTier,
      aiRationale: clampStr(item.aiRationale, 600, 'Evaluated for freelance hiring intent.'),
      suggestedPitch: clampStr(item.suggestedPitch, 2000, ''),
      alertSent: false,
      status: 'new' as LeadStatus,
      tags: [initialTag],
    };

    batch.set(doc(db, 'leads', leadId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    saved.push({
      id: leadId,
      ...payload,
    });
  }

  try {
    await batch.commit();
    return saved;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `leads (campaign ${params.campaignId})`);
  }
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  const path = `leads/${leadId}`;
  try {
    await updateDoc(doc(db, 'leads', leadId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLeadTags(leadId: string, rawTags: string[]): Promise<void> {
  const path = `leads/${leadId}`;
  const sanitized = Array.from(
    new Set(
      rawTags
        .map((t) => normalizeLeadTag(t))
        .filter((t) => t.length >= 1 && t.length <= 24)
    )
  ).slice(0, 8);

  try {
    await updateDoc(doc(db, 'leads', leadId), {
      tags: sanitized,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLeadDoc(leadId: string): Promise<void> {
  const path = `leads/${leadId}`;
  try {
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordAlertSent(params: {
  ownerId: string;
  leadIds: string[];
  recipientEmail: string;
  subject: string;
  gmailMessageId: string;
}): Promise<void> {
  const boundedIds = params.leadIds.slice(0, 50);
  if (boundedIds.length === 0) return;

  const batch = writeBatch(db);
  for (const id of boundedIds) {
    batch.update(doc(db, 'leads', id), {
      alertSent: true,
      updatedAt: serverTimestamp(),
    });
  }

  const alertId = generateSafeId('alert');
  batch.set(doc(db, 'alertLogs', alertId), {
    ownerId: params.ownerId,
    leadIds: boundedIds,
    recipientEmail: clampStr(params.recipientEmail, 254, 'user@example.com'),
    subject: clampStr(params.subject, 240, 'Leadin High-Value Prospect Alert'),
    highValueCount: boundedIds.length,
    gmailMessageId: clampStr(params.gmailMessageId, 128, 'sent'),
    sentAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `alertLogs/${alertId}`);
  }
}
