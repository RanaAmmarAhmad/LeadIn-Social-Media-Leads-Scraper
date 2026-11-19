# Security Specification — Leadin Firestore Rules

## 1. Data Invariants
1. **Strict Ownership**: Every `UserProfile`, `Campaign`, `Lead`, and `AlertLog` belongs exclusively to a verified authenticated user (`request.auth.uid`) and is unreadable and unwritable by any other user.
2. **Orphan Prevention**: A `Lead` cannot be created unless its referenced `campaignId` exists in `/campaigns/{campaignId}` and belongs to the same `request.auth.uid`.
3. **Immutable Audit Fields**: `ownerId`, `uid`, `email`, `createdAt`, `campaignId`, and `sentAt` cannot be modified after creation.
4. **Server Temporal Integrity**: All `createdAt`, `updatedAt`, and `sentAt` timestamps must strictly equal `request.time`.
5. **Terminal State Locking**: Once a `Campaign` transitions to `completed` or `failed`, it cannot be mutated again. `AlertLog` records are append-only and immutable after creation.
6. **Bounded Resource Sizes**: Every string, array (`leadIds.size() <= 50`), and integer (`aiScore` 0..100, `alertThreshold` 0..100) has explicit upper/lower bounds and strict `keys().hasAll` / `keys().hasOnly` checks.

## 2. Dirty Dozen Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Lead Read**: `get /leads/lead_1` with `auth = null`.
2. **Unverified Email Write**: `create /users/uid_1` with `email_verified = false`.
3. **Cross-User Spoofing on Create**: `create /campaigns/camp_1` with `ownerId: "victim_uid"` when signed in as `"attacker_uid"`.
4. **Cross-User List Scraping**: `list /leads` without `where('ownerId', '==', auth.uid)`.
5. **Orphaned Lead Injection**: `create /leads/lead_1` referencing a non-existent `campaignId: "missing_camp"`.
6. **Cross-Tenant Campaign Hijack**: `create /leads/lead_1` referencing another user's valid `campaignId`.
7. **Shadow Field Injection**: `create /leads/lead_1` adding `{ isAdmin: true }` alongside valid fields.
8. **ID Poisoning Attack**: `create /leads/<200-char-invalid-id!@#>` violating `isValidId()`.
9. **Client Timestamp Forgery**: `create /campaigns/camp_1` supplying a hardcoded past timestamp instead of `request.time`.
10. **Terminal Campaign Tampering**: `update /campaigns/camp_done` when `existing().status == 'completed'`.
11. **Value Poisoning on Update**: `update /leads/lead_1` setting `status: 12345` or `aiScore: 999`.
12. **AlertLog Tampering**: `update /alertLogs/log_1` attempting to alter `recipientEmail` or `highValueCount`.
