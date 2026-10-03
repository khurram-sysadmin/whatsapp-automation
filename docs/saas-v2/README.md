# SaaS v2 upgrade

Follow `upgrade-guide.md` in its strict order: Supabase foundation, n8n backend, frontend, partner integration, cutover. `contract.md` freezes the backend contract. Existing v1 routes, functions and sender remain operational.

Owner email: khurram@eightbitsolutions.com. Provider mode: pending_partner.

## Foundation

The exact guide SQL is in `backend/supabase/v2-foundation/`. Identity and private-table migrations were approved and applied to the live Supabase project on 2026-10-03. The user created the real owner Auth account privately, then explicitly approved workspace ownership and existing data linking. The actual-owner backfill was applied; the `.template.sql` version remains reusable. Never substitute a mock UUID in production.

Step 8 and extended live verification passed: owner profile/member/subscription exist, and no legacy campaigns, contacts or messages are missing workspace links or master-contact links. All nine v1 function definitions still match the preflight. See `live-owner-verification.json`. The guide imports the existing legacy session with status connected; this imported status is not evidence of a fresh provider connection check.

`npm run test:v2-foundation` verifies the migrations, legacy backfill, isolation and all nine existing v1 function definitions locally. Supabase Vault is unavailable in the local test engine; live preflight confirmed the extension is available. See `local-foundation-verification.json`.

## Required review gate

Prepare `supabase-v2-runtime.sql` and the updated single n8n workflow JSON only after foundation checks. Provide both for review before executing or importing. Do not cut over the frontend before the backend contract is verified.

## Dispatch compatibility issue to resolve before runtime approval

The preserved v1 sender reads the shared campaigns/messages tables. A local reproduction confirmed both `claim_next` and `begin_send` accept a message assigned to a different workspace/session. The existing workflow send node uses one fixed provider credential. JWT validation on the v2 API does not protect the independent legacy scheduled sender. See `dispatch-compatibility-report.json` and run `node tests/v2-dispatch-compatibility.mjs` (no external calls).

The guide prohibits replacing v1 functions but also expects v2 work in shared tables. Asked the user to choose an explicit correction: separate private v2 campaign/queue storage, or narrowly scoped legacy routing isolation. No design exception or runtime change has been applied. Do not activate v2 sending before this is resolved and reviewed.

Git changes do not deploy the dashboard, database or n8n workflow. `progress.json` records which phases actually ran.
