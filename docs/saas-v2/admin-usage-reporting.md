# Owner usage reporting (staging)

Migration `008-admin-usage-reporting.sql` adds an owner-only `public.platform_admins` allowlist and the `outreach_v2.admin_usage_v2(uuid)` aggregate function. The response includes the owner email, workspace, plan/status, trial end, registered/connected WhatsApp account counts, campaign totals/running/completed counts, and per-campaign contact/queued/sent/failed counts.

It deliberately excludes contact names and phones, message bodies, media URLs, API keys, webhook secrets, provider responses, and raw message content. `platform_admins` is deny-by-default; insert the operator's Auth user UUID privately in the staging SQL editor after reviewing the migration. Never use an email address as the authorization key.

The API action is `adminOverview` and requires no workspace ID. It returns `FORBIDDEN` for every authenticated user not present in `platform_admins`. The current frontend has no admin page yet; when the updated frontend is supplied, map its table columns to the stable response names in this contract instead of reading private tables directly.
