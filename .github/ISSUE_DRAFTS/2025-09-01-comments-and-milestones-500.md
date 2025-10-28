# 500 errors on Comments and Milestones due to audit_logs schema mismatch (column "timestamp") and query bug

## Summary
Navigating to an issue’s comments triggers 500 responses from API endpoints. Server logs show repeated Postgres errors when writing audit logs: column "timestamp" of relation "audit_logs" does not exist (SQLSTATE 42703). Additionally, the milestones list endpoint intermittently 500s due to an invalid ORDER BY alias.

## Impact
- Comments API: 500 on `GET /api/issues/:id/comments` (proxied to `/api/comments`) and 500 on posting comments in some flows.
- Milestones API: 500 on `GET /api/milestones?projectId=...`.
- Numerous audit log failures on user sync/auth flows.

## Repro steps
1. Sign in (Auth0 configured) and open an issue details page with comments.
2. Network panel shows:
   - 500 on `/api/issues/:id/comments` and/or `/api/comments`.
   - 500 on `/api/milestones?projectId=...`.
3. Server logs include (abridged):
   - `Error [PostgresError]: column "timestamp" of relation "audit_logs" does not exist (42703)`
   - Query attempting: `insert into "audit_logs" ("id","timestamp",...) values (default, default, ...)`

## Key logs
```
Failed to log audit event: Failed query: insert into "audit_logs" ("id", "timestamp", ...)
[cause]: column "timestamp" of relation "audit_logs" does not exist (42703)
```
And Network:
```
/api/issues/117/comments 500
/api/milestones?projectId=103 500
```

## Root cause analysis
1) Database schema mismatch for audit_logs
- Drizzle schema (`src/db/schema.ts`) defines `audit_logs.timestamp TIMESTAMP DEFAULT NOW()` and code reads/filters by `auditLogs.timestamp`.
- Insert SQL automatically includes the `timestamp` column with `DEFAULT` when writing audit logs.
- The active database’s `audit_logs` table lacks this `timestamp` column (legacy or drift), so inserts fail (42703) anytime auth/user sync logs an event.
- While `logAuditEvent` catches and logs the failure (so it shouldn’t crash the primary flow), the failure occurs early during auth checks across many routes and can contribute to degraded behavior and unexpected 500s.

2) Milestones GET uses an invalid ORDER BY alias
- File: `src/app/api/milestones/route.ts`
- Code: `.orderBy(asc(milestones.dueDate), sql`m.created_at DESC` as any)`
- No alias `m` is defined in the Drizzle query; this produces a SQL error in some environments, causing 500s on milestones listing.

3) Comments endpoint depends on auth bootstrap
- `GET /api/issues/[id]/comments` forwards to `/api/comments`, which calls `getCurrentUserRole()`.
- `getCurrentUserRole()` triggers `syncUserToDatabase()`, which logs an auth event; when that insert fails repeatedly, it increases likelihood of 500s from upstream auth/config problems. Even when downgraded to 401, the user experience is broken.

## Proposed fixes
A. Repair DB schema: add missing column
- Run migration to add the missing column (safe/idempotent):
```sql
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs("timestamp" DESC);
```
- Optionally backfill `timestamp` from `created_at` where null:
```sql
UPDATE audit_logs SET "timestamp" = COALESCE("timestamp", created_at) WHERE "timestamp" IS NULL;
```

B. Make API code resilient and remove alias bug
- Replace the milestones ORDER BY raw alias with a concrete column:
  - In `src/app/api/milestones/route.ts` use `.orderBy(asc(milestones.dueDate), desc(milestones.createdAt))` (import `desc`).
- In `src/lib/auditLog.ts` consider using `createdAt` consistently for sort/filter to avoid coupling to a non-essential `timestamp` column. Example changes:
  - Filter window: use `createdAt` instead of `timestamp` for `startDate`/`endDate`.
  - Ordering: `.orderBy(desc(auditLogs.createdAt))`.
  - This reduces risk if `timestamp` is missing in older DBs. Keep the column in schema to avoid breaking existing data.

C. Deployment/ops notes
- Confirm only one schema is in use (ensure `search_path` isn’t pointing to a different schema with an older `audit_logs`).
- If you’ve run both `database_setup.sql` and Drizzle migrations, verify they’re aligned. Prefer Drizzle migrations going forward.

## Acceptance criteria
- Adding a comment no longer returns 500; API returns 200/201 and payload includes comment plus author info.
- `/api/milestones?projectId=...` returns 200 with ordered rows, no SQL alias error.
- Audit events write successfully without 42703 errors.
- Basic list/filter of audit logs continues to function.

## Suggested follow-up
- Add a one-time migration script in `drizzle` to enforce `audit_logs.timestamp` presence.
- Update `src/lib/auditLog.ts` to rely on `createdAt` for sorting/filtering and keep `timestamp` as historical/secondary only.
- Add lightweight integration tests for comments and milestones endpoints.

---
Maintainer notes
- Environment variables are required for Auth0 and DB. If env is incomplete, auth helpers will degrade to 401s; confirm `.env.local` values and DB connectivity before testing.
