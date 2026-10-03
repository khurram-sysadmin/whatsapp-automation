# Approved guide amendments — 2026-10-03

The user's direct instruction supersedes the original guide where these decisions differ:

1. Every company uses its own WASender connection; multiple WhatsApp connections are supported in one workspace.
2. Customer campaign/queue storage is separate from v1. V1 functions, tables, routes and worker remain intact.
3. Customers provide their own per-session WASender API key through dashboard onboarding. n8n and Supabase remain operator-managed. Customers never enter n8n URLs, Supabase keys or database settings.
4. Partner approval is not required for the customer-supplied session-key path. Partner provisioning remains unavailable until genuinely configured. Do not fake QR provisioning.
5. Dashboard gives a step-by-step connection guide, verifies the key's connected status and phone using server-side WASender endpoints, and supports adding another number.

Original camelCase contract, Supabase Auth, role/membership authorization, idempotency, lifecycle rules and one n8n workflow remain. Secrets are write-only through the customer form, stored in Supabase Vault, omitted from browser responses and execution logs. Do not put API secrets in localStorage, workspace request caches, workflow JSON or public environment variables.

The original review gate remains: deliver schema supplement, runtime functions and updated workflow JSON before execution/import. Frontend implementation follows backend verification.

Official references checked 2026-10-03:
- https://api.wasenderapi.com/api-docs/authentication/how-to-authenticate-api-requests-using-bearer-tokens
- https://api.wasenderapi.com/api-docs/sessions/get-whatsapp-session-status
- https://api.wasenderapi.com/api-docs/sessions/get-session-user-info
- https://api.wasenderapi.com/api-docs/webhooks/webhook-setup

Customer wizard: Company → Create/connect WhatsApp in WASender → Paste session key → Verify connected number → Configure callback → Ready. Configure each session's HTTPS callback with its own webhook secret; verify signature before accepting events. API key proves provider connection identity, not workspace membership.
