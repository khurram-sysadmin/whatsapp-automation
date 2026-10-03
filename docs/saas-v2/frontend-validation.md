# SaaS frontend and backend checkpoint

Updated 2026-10-03. Upgrade branch: `upgrade/saas-v2-foundation`. This is a reviewed build and local preview, not a completed production cutover.

## What is implemented

The new entry point is `src/saas/SaaSApp.tsx`. Supabase Auth supplies the verified user session; `src/saas/client.ts` sends its JWT to n8n. The customer configures WASender only. Company ownership and access checks happen on the server. Existing v1 source, data and sender remain intact.

All ten pages have consistent navigation, spacing, forms, status labels and empty states. The sidebar contains the company name without developer version or role badges. Analytics uses actual backend counts and rates. Contacts remain company data independently of WhatsApp connections. Templates can be edited using the existing save-by-name contract. Reply drafts are cleared when conversations change; connection forms and template drafts are cleared when companies change.

Campaign creation requires a connected customer number. Completed is terminal. Delete archives, retains history and is repeat-safe. Customer keys are held only in the form until submission and are never returned in read responses or saved in browser storage. Supabase session tokens use tab sessionStorage; the publishable key is public configuration. No service key belongs in a VITE variable.

## Verification performed

| Check | Evidence and result |
| --- | --- |
| Clean dependency installation and production build | npm ci and npm run build passed. Final assets must be read from the release manifest. |
| Dependency audit | Zero known vulnerabilities after updating SheetJS from its [official distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Legacy workbook API and international phone text roundtrip passed. |
| Original lifecycle | 11 local checks passed, including immediate completion, stale Stop, terminal Completed and archive retries. |
| SaaS foundation | 10 local checks passed; profile trigger, legacy backfill, RLS and original function preservation covered. |
| Runtime | 12 local checks covering all 31 public actions passed. Vault is mocked locally; the test database has one connection. |
| Workflow | Original 41 nodes/connections preserved in the generated source; 51 additions in the same workflow. Every Code node and v2 parameter expression compiles. No automatic customer send retry. |
| Request client | Verified JWT use, stripped browser userId, requestId reuse after ambiguous writes, in-flight request sharing, safe malformed-response handling and multipart field names. No external calls in this suite. |
| Live owner login/read/reload | Owner login and dashboard reads through real n8n/Supabase worked. Refresh retained the session. No customer data mutations were needed. |
| Desktop | All ten pages opened with zero inline errors and no whole-page horizontal overflow. Their screenshots were visually reviewed. Contacts search/no-match state was checked without changing contacts. |
| Phone | All ten pages at measured 390 CSS pixels opened with zero inline errors and no whole-page overflow. Dashboard, WhatsApp Accounts, Contacts and Settings also passed at measured 342 CSS pixels. Temporary viewport settings were reset. |
| Authentication routes | Signup, login, forgot-password and reset-password screens opened. Missing reset-session links show instructions rather than a password form. No email or password change was submitted. |
| Live database access | Six private v2 tables have RLS; anon/authenticated cannot read them. Ten trusted wrappers allow only service_role. Vault reads are denied to browser roles. Original nine v1 function hashes and v1 health remain unchanged. See live-runtime-verification.json. |
| Live Vault encryption | Nonfunctional fixture was stored encrypted and decrypted correctly in a rollback-only transaction. No fixture was retained and no customer keys were read. See live-vault-verification.json. |
| Hosted workflow | The existing workflow was published with 92 nodes, customer schedule disabled and secret-bearing execution persistence disabled. Authenticated frontend reads work; missing/invalid JWT requests were rejected. |

## What is not claimed as verified

- User explicitly deferred real WASender connection, delivery and signed callback tests. The customer schedule remains disabled. No new customer messages were sent.
- Independent, concurrent production database transactions and quota contention still need verification before activation. Local single-connection tests do not prove this.
- Browser signup through email verification, emailed password-reset roundtrip and private password changes have not been exercised end to end. Confirm SMTP and allowed redirects before opening public signup.
- The authenticated frontend write flows involving actual customer numbers are not live-tested; their API functions and request handling are covered locally.
- Team invitations and role changes are support-managed. The frozen 31-action contract contains no self-service invitation API. Billing displays backend subscription/limits; it does not take payments.
- Existing v1 campaign/message history is retained in its original tables and original production dashboard. The new v2 campaign lists show the isolated customer queue. Plan history presentation and owner-number cutover before replacing production.
- The new frontend has not been uploaded to the production domain. Build, SQL installation, workflow publication and frontend upload are separate steps.

Do not label this checkpoint “everything works perfectly” or enable the customer schedule on the basis of local tests alone.

Final packaging/recovery check: a Windows/OneDrive ZIP watch lock stopped the development server during packaging. Vite now ignores release/document/backend artifacts. The server was restarted, the signed-in dashboard refreshed successfully, and duplicate errors are collapsed. Read failures say refresh failed; only ambiguous writes warn that an action may have completed. This change does not alter production CORS. Direct /campaigns and hard refresh were also checked.

Targeted SaaS lint has no errors and four advisory warnings: two effects deliberately clear asynchronous authentication/company state, and two cleanup handlers advance numeric generation counters to invalidate stale requests. These are tracked rather than represented as a warning-free audit.

## Logo and Google authentication follow-up — 2026-10-03

Preserved the original logo artwork and used multiply compositing to remove its visible white rectangle on page backgrounds. Signup/login have a Google button, improved headings, ordered onboarding benefits, email divider, clear link hierarchy, keyboard focus and mobile sizing. Both were reviewed at desktop/390px (and narrow273px without overflow). The Google-disabled fallback was exercised in signup; login/signup switching and provider failure preserve email sign-in.

Production build and legacy lifecycle passed; frontend suite now has six checks including Google readiness, trusted redirect validation and correct return origins. Public Supabase Auth settings currently report Google disabled. No Google OAuth credential or provider setting was created/changed. Real Google login is pending the operator steps in google-sign-in-setup.md. Production frontend remains not uploaded; WhatsApp testing stays deferred. Upload ZIP and manifest updated with this build.

Authentication recovery follow-up: if initial workspace loading reports an unauthorized/absent session, return to sign-in instead of leaving a Retry-only screen. The browser showed the sign-in form after the correction; build and client checks passed again. Real Google consent still awaits provider setup.
