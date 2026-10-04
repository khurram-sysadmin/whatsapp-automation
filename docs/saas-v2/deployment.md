# Deploying the SaaS frontend

This build uses Supabase Auth and the hosted n8n v2 API. Customers do not configure cPanel passwords, n8n credentials or Supabase secret keys. The production site still uses the previous frontend until this build is uploaded and checked.

## Operator configuration

Build-time public variables are exactly:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_OUTREACH_API_URL
VITE_OUTREACH_IMPORT_URL
VITE_APP_URL
VITE_DEFAULT_TIMEZONE
```

Use `.env.example` as the template and keep local configuration ignored by Git. Only a publishable Supabase key may enter this build. Supabase service credentials stay in the existing n8n credential; customer WASender secrets stay in Vault.

The deployment origin is `https://wamarketing.eightbitsolutions.com`. n8n permits that production CORS origin. The local Vite preview uses its private same-origin development proxy; this does not broaden production CORS. Confirm Supabase email redirect settings for `/login` and `/reset-password` and operator SMTP before public signup.

## Build and upload

Run npm ci, npm run build, npm run test:lifecycle, npm run test:v2-foundation, npm run test:v2-runtime, npm run test:v2-workflow and npm run test:v2-frontend. Run npm audit. The guide artifact is `WhatsApp-Automation-SaaS-cPanel-ready.zip`.

The ZIP contains only index.html, assets/, .htaccess, favicon.svg, icons.svg and logo.jpg at its root. It excludes API secrets, source, migration SQL, tests, private databases, node_modules and legacy PHP API files. PHP is not required by the new frontend itself. Existing PHP API/private storage must be retained for legacy operation and rollback.

Before upload, back up the current public frontend and external private folder. Confirm the actual document root in cPanel Domains; the exact hosting-account path has not been established. Extract the ZIP contents directly into that domain's document root, not into an extra dist/ folder. Preserve existing api/ and private data. Hidden .htaccess must be uploaded. Clean auth/application paths, including trailing slashes, are rewritten to the application correctly.

Verify HTTPS, the exact bundle in the release manifest, login, a hard refresh, direct page links, company isolation, logo and phone layout. A Git push or successful ZIP build does not verify the hosted upload.

## Current activation gate

The user deferred provider testing. Leave the new customer schedule disabled until real connection identity, signed callbacks, one authorized test message, concurrent leases and quotas are verified. Resolve the presentation/cutover of the owner's preserved v1 history before replacing production. Do not run two independently paced queues for the same owner number. Team management remains support-operated; there is no payment checkout.

For rollback, restore the previous frontend/public files and keep the existing private folder. Disable customer scheduling/writes while retaining reconciliation for in-flight sends. Never discard unknown outcomes, delivery history or stored secrets to make a test pass.

## Personalization and branded webhook package — 2026-10-04

The latest package also includes webhooks/whatsapp.php and lead-import-example.csv. PHP 8.1+ and curl are now required for the relay. Deploy these with the frontend before using the newly displayed branded webhook URL. Preserve existing provider webhook URLs until a signed callback works through the branded endpoint. This upload remains unverified. See personalization-and-connection-guide.md for rollout checks.

2026-10-04: Apply backend/supabase/v2-review/007-active-connection-names.sql after 006. Installed live; archived names no longer block replacement connections. No cPanel reupload for this migration.

2026-10-04: Migration 008-private-connection-checks.sql installed; existing workflow published as 71f3e4a7-636f-4ffd-93c5-111acc76d8c2 with 93 nodes. Private failure metadata only; browser access denied. Latest hosted JS index-DuwhzciE.js verified byte-for-byte; no new cPanel build required. See automatic-customer-setup.md for verification limits and pending private retry.

2026-10-04: Latest automatic-only cPanel ZIP removes every old manual setup entry point from the customer dashboard. Canonical SaaS ZIP identical, JS index-BicySaTk.js. Upload pending. Backend remains existing 93-node published workflow; provider session124608 is Connected with correctly matching pending webhook, but identity timeout remains unresolved. See automatic-customer-setup.md.

2026-10-04: User uploaded the automatic-only package. Eight public asset hashes and browser BicySaTk match. Automatic PAT recovery completed for existing pending Khurram Space connection; Vault references stored and correct company confirmed. Signed callback/delivery for this connection remains pending. See automatic-customer-setup.md for evidence; PHP source/hash was not inspected publicly.
