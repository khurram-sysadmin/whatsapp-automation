# Installed SaaS backend and review status

Updated 2026-10-03. The user approved the review package before installation. This supersedes the earlier prepared-only checkpoint. Production frontend remains v1; the new local frontend reads the installed backend successfully.

## Installed components

- Supabase 004 isolated storage, complete runtime, 005 frontend contract and 006 session metadata applied. Six private queue tables have RLS and no browser-role read grants. All ten trusted wrappers are service_role only. Original nine v1 function hashes and v1 health remain unchanged.
- Vault access is denied to browser roles. A nonfunctional rollback-only fixture verified real encryption/decryption and left no record. No customer keys were read. See live-runtime-verification.json and live-vault-verification.json.
- Existing EightBit WhatsApp Outreach workflow biQP0tU694qWD8P9 published with 92 nodes: original 41 plus 51 additive nodes. The customer scheduler is disabled; v1 sender remains intact. Execution persistence is disabled to protect secret-bearing runs.
- Reuses the saved Supabase account 2 credential (supabaseApi). No generic header credential, new operator secret or n8n variable is required. The publishable key used for JWT verification is public configuration. Customers never configure Supabase or n8n.
- The corrected Execute Action expression compiles and authenticated reads work. Missing/invalid JWT is rejected and production OPTIONS/CORS checked. Generated full and additive files are templates, not a fresh export of live node identities.
- Ten-page frontend and customer setup wizard built, visually reviewed and packaged. No production frontend upload has occurred.

## Contract and local verification

The frozen 31 public actions remain intact. Every action is exercised locally, including company/role boundaries, multiple sessions, key routing, idempotency, immediate Completed, stale Stop, repeat archive, signed callbacks and unknown-outcome protection. Original graph and every v2 expression compile. Legacy lifecycle tests pass. See frontend-validation.md for the full test matrix.

Local PGlite uses mocked Vault and one connection. Live rollback encryption and privilege checks supplement those tests, but do not prove independent concurrent transactions. The local workflow report's importedIntoN8n=false describes the test harness, not installation status.

## Remaining activation checks

The user explicitly deferred WASender connection, real delivery and callback testing. No new customer messages were sent. Keep customer scheduling disabled until real connection identity, signed callbacks, an authorized test send and concurrent lease/quota behavior are verified. Verify same-session exclusion, independent-session progress, lock ordering and quota reservations with separate real database transactions.

Verify signup/email-reset roundtrips and operator SMTP before public signup. Team changes remain support-managed and billing has no payment checkout. V1 campaigns/messages remain in their original tables; plan history presentation and owner-number cutover before replacing production. Stop/drain v1 before binding the same owner number to v2 to avoid two independently paced queues.

## Rollback

Disable customer scheduling and writes while retaining callback/finish reconciliation for in-flight messages. Preserve the old v1 routes/sender and private site storage. Do not reset unknown outcomes, drop audit history, delete customer data or remove Vault secrets during recovery. Restoring Git alone does not roll back SQL or hosted n8n. Compare the current live graph before importing generated templates; never overwrite later edits blindly.
