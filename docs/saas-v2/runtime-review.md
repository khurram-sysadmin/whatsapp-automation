# Backend review and installation gate

Prepared 2026-10-03. NOT installed. Current production remains v1. The user guide says: “Do not immediately execute it.” Review this package before SQL execution or n8n import.

## Review files
1. backend/supabase/v2-review/004-isolated-storage.sql — separate private customer campaign/message queue; no legacy rows moved.
2. backend/supabase/v2-review/supabase-v2-runtime.sql — JWT-verified membership/roles, 31 public actions, worker leases, callbacks, completion and idempotency.
3. backend/n8n/v2-review/eightbit-whatsapp-outreach-v2.json — one workflow, 92 nodes: original 41 preserved plus 51 additions. The new customer worker is disabled.
4. docs/saas-v2/approved-amendments.md and customer-WASender-onboarding.md — approved contract exceptions and future customer wizard.
5. docs/saas-v2/node-change-report.json and local verification reports — review evidence.

## What changed
Each company can own multiple customer-key WhatsApp connections. Customer sends read only their claimed session's encrypted key. Supabase/n8n remain operator-managed. Separate v2 storage prevents the preserved legacy sender from claiming another company's messages. Original nine v1 function bodies and original workflow graph stay unchanged. Workflow execution persistence is disabled for all branches to keep bearer tokens and session keys out of stored runs. No frontend source changes or production cutover are included.

## Local verification
All 31 public actions exercised; cross-company scope, roles, key routing, independent sessions, idempotency, immediate Completed, deletion retry, webhook deduplication and unknown-outcome protection passed. Original workflow graph and embedded Code syntax passed; XLSX expansion is bounded before parsing. Legacy lifecycle regression and frontend build passed. See runtime-local-verification.json and workflow-local-verification.json.

PGlite uses a mock Vault and single database connection: real Vault encryption/permissions and concurrent database transactions are NOT proved. No real provider calls or test messages were sent; workflow has NOT been imported into n8n.

## Operator checklist after review approval
- Take fresh live SQL/function and n8n snapshots. Compare original 41-node baseline against current live workflow; do not overwrite newer production edits.
- Apply isolated storage before runtime, then reload PostgREST schema. Verify actual Vault schema/table/function access denies anon/authenticated/PUBLIC and never expose decrypted_secrets. Service-only wrappers must remain service-only.
- Privately create/select n8n HTTP Header Auth credential “Supabase SaaS Backend”: header apikey, value the project's secret API key. Replace every CONFIGURE_SAAS_BACKEND_CREDENTIAL reference. Set EB_SUPABASE_PUBLISHABLE_KEY as the project's publishable key. Never put operator secrets in customer settings or browser code.
- Import into the existing EightBit WhatsApp Outreach workflow, preserving its ID and old graph; do not create another active legacy sender. Keep the new customer schedule disabled initially.
- Verify invalid JWT rejection BEFORE database writes, workspace membership and role boundaries, two companies/two connections, private callback signature handling and tenant-scoped suppression.
- In real PostgreSQL use separate concurrent transactions to verify same-session exclusion, different-session progress, lock ordering and monthly quota reservations. Verify expired dispatch becomes unknown and never auto-resends.
- Enter a real customer connection privately. Verify status/phone and signed callbacks, then explicitly authorize the recipient/message for one delivery test. Enable the new worker only after these checks.
- Complete frontend v2/wizard only after backend contract verification. Current v1 history remains in v1; history migration and owner-number cutover need explicit planning. Stop/drain v1 before binding the same legacy owner number to v2 to avoid two independently paced queues.

## Rollback
Disable new customer scheduling and new customer API writes; preserve the old v1 sender/routes. Keep callback/finish reconciliation available for in-flight messages. Do not reset unknown outcomes, delete customer data, drop audit history or remove Vault secrets during incident recovery. Restore the previous workflow graph only after recording/reconciling new in-flight work; preserve secret-safe logging settings. Git rollback alone does not roll back SQL or hosted n8n.
