/**
 * Security Rules Specification Verification Matrix for Leadin
 * Documents the Dirty Dozen attack payloads enforced by firestore.rules.
 */
export const dirtyDozenSecurityCases = [
  { id: 1, name: 'Unauthenticated Lead Read', path: '/leads/lead_1', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified Email Write', path: '/users/uid_1', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Cross-User Spoofing on Create', path: '/campaigns/camp_1', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Cross-User List Scraping', path: '/leads', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Orphaned Lead Injection', path: '/leads/lead_1', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Cross-Tenant Campaign Hijack', path: '/leads/lead_1', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Shadow Field Injection (isAdmin)', path: '/leads/lead_1', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'ID Poisoning Attack', path: '/leads/bad!id', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Client Timestamp Forgery', path: '/campaigns/camp_1', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Terminal Campaign Tampering', path: '/campaigns/camp_done', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Value Poisoning on Update', path: '/leads/lead_1', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'AlertLog Immutability Bypass', path: '/alertLogs/log_1', expected: 'PERMISSION_DENIED' },
] as const;
