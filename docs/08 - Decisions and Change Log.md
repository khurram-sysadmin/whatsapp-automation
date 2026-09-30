# Decisions and change log

## Fixed requirements

- One n8n workflow for the full outreach system.
- Supabase HTTPS API connection; no PostgreSQL credential setup for the operator.
- Supabase/provider secrets remain server-side in n8n; browser saves no secrets.
- First visit creates one admin username/password; later visits sign in. No product reliance on a cPanel password.
- Preserve existing functions/design, Eightbit logo, imports, delivery/reply processing and sending safeguards.
- Completed campaigns finish automatically, show Completed, cannot restart. Create a new campaign to send again.
- Delete removes a campaign from the dashboard on the first successful archive without destroying delivery/audit context.
- Future fixes must use this context plus actual current code/runtime verification.

## 2026-09-30: deployment/authentication repair

Rebuilt a proper cPanel artifact, corrected logo framing and frontend initialization/routing, replaced prototype browser authentication/storage with private PHP single-admin authentication, CSRF/origin validation and same-origin proxy. User asked for simple one-time admin setup instead of manual cPanel/private credential configuration.

## 2026-09-30: backend connection repair

Migrated site connection persistence to private SQLite with legacy config seeding, blank-key preservation and OPcache-safe behavior. Restored explicit Campaign API URL plus masked Frontend Auth setting. Added real n8n/Supabase/import-auth checks. Backend 401/403 no longer invalidates admin login. Applied Supabase hardening wrapper for contacts/suppression/archive/template actions and real stats. Published authentication and validation changes in the existing n8n workflow, preserving send nodes/graph. User confirmed working.

## 2026-09-30: campaign lifecycle repair

Live Delete execution 5674 returned 409 because an uncertain message outcome blocked archive. Live Stop executions 5772/5775 returned generic state errors after backend completion. Migration 003 removed the archive outcome blocker while preserving records, made completed-state controls harmless, rejected new starts, and added completion in the final message transaction. UI gained five-second active detail refresh, stale-response protection, 100% processing progress on Completed and lost-delete-response reconciliation. 32 lifecycle/regression checks passed (18+11+3); no new WhatsApp messages sent.

## 2026-09-30: GitHub and durable context

Confirmed `khurram-sysadmin/whatsaoo-automation` is the same project: seven original configuration files matched the supplied source and deployment guide used the same dashboard/n8n endpoints. Added full working source, versioned SQL, sanitized current workflow export, release ZIP, test evidence and these operational notes. Repository spelling is historical; no new repository or rename requested. Live website referenced the campaign-fix hashed bundle during this update. Git commit/push identity is recorded in the project note after push.
