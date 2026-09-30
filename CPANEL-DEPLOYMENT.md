# Deployment and operations

## Current deployment

Domain: https://wamarketing.eightbitsolutions.com. HTTPS cPanel/Apache serves compiled Vite assets and executes PHP API scripts. PHP 8.1+ with curl, pdo_sqlite and mbstring is required. Node/npm is needed to build locally, not to serve the production frontend. Original Nginx-only Docker files are legacy and cannot execute this edition's PHP backend.

On 2026-09-30, public HTML referenced `assets/index-D_uxLgXs.js`, the campaign-fix bundle. The public JS bytes were checked against the release artifact. This verifies the current bundle upload, not every authenticated UI action or delivery receipt. The user previously confirmed the connection repair was working. Recheck live files and authenticated flows after future deployments.

## Rebuild and upload

```sh
npm ci
npm run build
npm run test:lifecycle
```

For cPanel, package the contents of dist/ at ZIP root, including hidden `.htaccess`, assets/, api/, index.html and logos. Do not upload source, node_modules, test folders, database migration SQL or private files into the document root. The committed `releases/WhatsApp-Automation-Campaign-Fix.zip` is the checked 2026-09-30 artifact. New source changes need a new build/ZIP.

Back up current public files and the external private folder. Use cPanel Domains to confirm the real document root; its exact account path has not been recorded. Extract/replace public files directly there, retain the private folder and hard refresh. Confirm index.html serves the new hashed script, api PHP executes rather than downloads, direct routes refresh correctly and logo/mobile layout remain intact. Do not claim deployment from a build or Git push alone.

Existing installation: sign in with existing admin account; Settings -> Backend Connection -> Test Connection. Leave key blank to preserve it when saving. If rejected, enter the actual existing Frontend Auth value privately in Settings, not in chat. Fresh install: first visit creates the single administrator once; then connect n8n. No cPanel account password is used for product authentication.

## Safe maintenance

1. Read the start-here note, actual code, published workflow and current SQL before edits.
2. Identify whether the failure is browser/PHP/auth, n8n validation, RPC/state, queue, or provider receipts.
3. Back up affected artifacts and record current branch/commit/version.
4. Make the smallest contract-preserving change. Keep design and sending safeguards.
5. Use local mocks or rolled-back SQL fixtures before customer-facing tests.
6. Build, run lifecycle tests, check PHP syntax and targeted browser regressions.
7. Apply only the needed migration/published workflow update; upload frontend only if changed.
8. Verify actual response success/status and UI result, then update docs/change log.

Do not run schedule/manual sender triggers merely to test connectivity. Read-only API tests and empty import validation do not send. Any new delivery test needs an explicitly authorized recipient, and must distinguish provider accepted, delivered and read. No new WhatsApp message was sent during connection/lifecycle repair verification.

## Backups and recovery

Keep cPanel private auth.sqlite/config/sessions backup outside the public root and out of Git. Back up Supabase with owner tools and n8n credentials separately using approved secure storage. Workflow JSON does not contain credential values. Restore compatible website, SQL and workflow versions as a set. Never delete auth.sqlite as a routine fix: it removes the admin/connection state and reopens initial signup. Password recovery requires an owner-controlled operation; no public reset bypass was added.
