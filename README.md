# EightBit WhatsApp Outreach

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
