# Frontend and private PHP API

## Application

React 19, TypeScript, Vite, Tailwind, Recharts, Lucide, PapaParse and XLSX. `src/App.tsx` coordinates authentication, routing, shared refreshes, mutations and error states. `src/services/api.ts` wraps same-origin requests. `src/services/normalize.ts` safely handles missing/numeric/null data. `src/pages/CampaignDetailPage.tsx` handles campaign polling and actions. `src/pages/SettingsPage.tsx` handles defaults and connection checks. Original Eightbit JPG artwork is preserved; logo framing was corrected.

Routes: `/dashboard`, `/campaigns`, `/contacts`, `/templates`, `/messages`, `/replies`, `/suppression`, `/settings`. A selected campaign uses `?campaignId=<UUID>`. Apache `.htaccess` supports direct-route refreshes. Vite builds relative assets for the deployment folder. `dist/` is compiled output, not development source.

The campaign wizard creates a real draft, then imports the selected CSV/XLSX file. It does not silently start a campaign or create another campaign if import fails. Operators review contacts, then select Start. Imports accept CSV/XLSX up to 5 MB; backend normalization handles up to 5,000 rows per request, deduplication, allowed fields, template variables and international phone validation. Excel phone cells should be Text. Import uses multipart field `file` and a campaign UUID/request ID.

## PHP endpoints

Source: `public/api/`; copied to `dist/api/` during build.

| File | Purpose |
| --- | --- |
| `bootstrap.php` | Private folder/config discovery, SQLite, sessions, origin/CSRF checks, upstream requests |
| `private-path.php` | Locates existing private config outside document root; contains no secret |
| `session.php`, `signup.php`, `login.php`, `logout.php` | One administrator and server-side authentication |
| `password.php` | Password change and session invalidation |
| `connection.php` | Saves connection and tests n8n, Supabase data, import authorization |
| `settings.php` | Stores operator campaign defaults |
| `proxy.php` | Forwards validated JSON actions to n8n |
| `import.php` | Forwards multipart upload |

## Private storage and authentication

On cPanel, the app discovers the account home and creates `/home/<account>/eightbit-outreach-private/`, outside public web roots. It reuses existing storage. `OUTREACH_CONFIG` can point to an existing external `config.php`; the locator also searches parent folders for existing private configuration. Never delete this directory during website replacement.

Private files: `config.php` (origin/legacy seed key), `auth.sqlite` (users, login limits, metadata, preferences, backend_connection), `sessions/`. Table `users.email` stores the administrator username despite its historical column name. Passwords are hashes, not plaintext. Signup is available only when no administrator exists, with a transaction and unique single-admin index. Username length 3–64; password 12–72 bytes. There is no multi-user signup or Quick Sign In.

Session cookie: HttpOnly, Secure in production, SameSite Strict. Session timeout: 30 minutes idle / 8 hours absolute. Password change increments session version and invalidates existing sessions. Mutation requests require same-origin Origin and a session CSRF token. Do not bypass auth to debug backend failures.

## Connection persistence

`backend_connection` in private SQLite stores canonical `api_url`, `auth_key`, `updated_at`, `last_check`. Legacy `config.php` key is seeded only when this row does not exist. Blank-key saves preserve the stored key. GET never returns it. PHP OPcache does not cache these database settings; legacy config is invalidated before initial migration.

Settings accepts only the production EightBit Campaign API URL or its corresponding base URL, not arbitrary hosts. The Frontend Auth field takes the existing n8n header credential value, not the n8n MCP/API token. Browser environment variables are not used for secret storage.

Test Connection checks health, real Supabase statistics, contacts/suppression features, and an empty import that must fail with the expected missing-file validation error. This last check proves import authorization without importing contacts or sending messages. Saved does not mean Verified.

An upstream 401/403 becomes a useful 502 connection error rather than an operator session-expired 401. Temporary outages retain saved credentials and existing data. Request outcome uncertainty is reported explicitly; deletes additionally check for an already-archived campaign before reporting failure.

## Campaign UI

Start exists only for drafts with contacts; Pause/Stop for running campaigns; Resume/Stop for paused campaigns; Delete for draft/paused/stopped/completed. Completed has no Start, Stop or Resume. Active detail polling is five seconds; other detail polling is fifteen seconds; global refresh is thirty seconds. Older responses cannot restore Completed controls or a deleted campaign. The page shows 100% processing progress when Completed; delivery/failure totals remain real.
