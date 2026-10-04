# EightBit WhatsApp Outreach

## SaaS upgrade checkpoint — 2026-10-03

This branch builds the company dashboard with Supabase Auth, multiple customer WASender connections, and the existing n8n workflow. The hosted v2 backend is installed; the professional ten-page frontend is verified in the local preview and packaged for upload. The production frontend remains v1. Customer sending was enabled with explicit approval on 2026-10-04; the first selected message was accepted and its campaign automatically completed. See docs/saas-v2/sender-activation-2026-10-04.md for current evidence and remaining checks.

Start with [SaaS validation and remaining checks](docs/saas-v2/frontend-validation.md), [SaaS deployment](docs/saas-v2/deployment.md), [backend installation status](docs/saas-v2/runtime-review.md) and [frozen contract](docs/saas-v2/contract.md). Run the four `test:v2-*` scripts as well as lifecycle tests and build. The new static release is `releases/WhatsApp-Automation-SaaS-cPanel-ready.zip`; its manifest records final asset hashes. Customer settings contain no operator Supabase/n8n credentials.

The following describes the preserved v1 production edition and its rollback files.

Working WhatsApp campaign dashboard with React/TypeScript, private PHP authentication/proxy, one n8n workflow, Supabase persistence and WASender integration. This is the application at https://wamarketing.eightbitsolutions.com.

## Build and test

```sh
npm ci
npm run build
npm run test:lifecycle
```

Deploy the contents of `dist/` to an HTTPS Apache/PHP site. PHP 8.1+ with curl, pdo_sqlite and mbstring is required. A Vite preview or the legacy Nginx-only Docker container cannot execute the private PHP API.

## Project layout

- `src/`: dashboard application.
- `public/api/`: single-admin signup/login, private persisted connection, settings, same-origin n8n proxy and import.
- `backend/supabase/`: fresh-install base SQL and ordered migrations; current project already has all three applied.
- `backend/n8n/eightbit-whatsapp-outreach.json`: current 41-node workflow snapshot, inactive on import, credential references only.
- `docs/`: architecture, frontend, database, n8n, deployment, troubleshooting, verification and decisions.
- `tests/lifecycle.mjs`: in-memory database contract tests; no external sends.
- `releases/`: checked cPanel campaign-fix ZIP and upload instructions.

Start with [Architecture](docs/01%20-%20Architecture%20and%20Service%20Map.md), [Deployment](CPANEL-DEPLOYMENT.md) and [Troubleshooting](docs/06%20-%20Troubleshooting.md).

The backend repair is live. On 2026-09-30 the public site referenced the latest campaign-fix bundle and its bytes matched the release. Runtime state and credentials must be rechecked before later edits. Completed campaigns cannot restart; create a new campaign to send again. Delete archives rather than destroys audit records.

No credentials, private databases, session files, customer exports or live execution payloads belong in this repository. The Supabase service key stays in n8n; the site's Frontend Auth key stays in private storage outside the web root. Preserve that private folder when replacing the website.

## Customer sender activation — 2026-10-04

Resolved the pending campaign: the published v2 customer schedule was disabled from the earlier deferred provider test. Read-only checks found one queued message, zero attempts, and ready connection/key/sender/window metadata. No other queued campaign, standalone message or in-flight/unknown message was present. The user explicitly authorized the selected recipient test.

Enabled only V2 Customer Queue Every 15 Seconds in the existing 92-node workflow biQP0tU694qWD8P9 and published version 1af85b6e-5bfa-41ef-81ee-197106cc0af0. Read-back confirmed active workflow and enabled customer schedule. The message reached sent with one attempt and provider acknowledgement; its campaign automatically reached completed without error. Recipient delivery/read status and signed callbacks are not yet verified. No frontend or cPanel package changed.

Import templates remain inactive with the customer schedule disabled intentionally. The published sender is now enabled; review settings before any reimport. See repository docs/saas-v2/sender-activation-2026-10-04.md and progress.json for the current checkpoint. Earlier deferred-activation notes are historical.

2026-10-04: The upload package now includes clickable template fields, illustrative personalized previews, an example leads CSV, clearer WhatsApp setup and a branded webhook relay. This package requires PHP 8.1+ with curl for the relay; upload/callback verification remains pending. See docs/saas-v2/personalization-and-connection-guide.md.

Automatic customer setup now uses a temporary account PAT and server-side webhook configuration. Local validation passed; hosted/PAT/callback verification remains pending. Read docs/saas-v2/automatic-customer-setup.md before deployment or live testing.
