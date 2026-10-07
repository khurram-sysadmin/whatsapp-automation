# Owner usage reporting

Migration `008-admin-usage-reporting.sql` adds an owner-only `public.platform_admins` allowlist and the `outreach_v2.admin_usage_v2(uuid)` aggregate function. The response includes the owner email, workspace, plan/status, trial end, registered/connected WhatsApp account counts, campaign totals/running/completed counts, and per-campaign contact/queued/sent/failed counts.

It deliberately excludes contact names and phones, message bodies, media URLs, API keys, webhook secrets, provider responses, and raw message content. `platform_admins` is deny-by-default; insert the operator's Auth user UUID privately in the staging SQL editor after reviewing the migration. Never use an email address as the authorization key.

The API action is `adminOverview` and requires no workspace ID. It returns `FORBIDDEN` for every authenticated user not present in `platform_admins`. The current frontend has no admin page yet; when the updated frontend is supplied, map its table columns to the stable response names in this contract instead of reading private tables directly.

## Production verification - 2026-10-07

Migration 015-admin-usage-totals.sql applied successfully to lreolnewuapcurpskqwr. It preserves the adminOverview workspace-array contract and adds owner workspace totals, timezone/status, monthly and lifetime sent counts. Suspended workspaces are retained for accounting. Optional trial date uses to_jsonb for compatibility. A separate service-only admin_user_usage_v2 function reports every registered user, including users without owned workspaces, with nested workspace summaries. Workspace ownership uses created_by; membership is not billed as an additional owner workspace.

Report functions require an existing platform_admins entry and cannot be called directly by anon/authenticated roles. The trusted API's existing adminOverview branch still uses its verified user ID and calls through its SECURITY DEFINER owner. No new admin identity or broader customer access was granted. No confidential message fields, recipient details, media or provider secrets appear in these reports.

Live reconciliation: 8 registered users, 9 workspaces, 7 non-archived campaigns and 102 monthly sent messages at inspection. Report lifetime total matched usage_monthly and direct browser execution was denied. Monthly period follows the existing UTC database counter, not each workspace's display timezone. Sent means provider accepted once; queued, failed and uncertain outcomes do not count as successful sends. Delivery/read events do not add another billable message. Deleted campaign history still contributes to retained sent usage. The report has no automatic charging behavior.

Existing production workspaceCreate saves workspaces, owner membership and beta/active subscriptions. Trial/pricing enforcement remains deferred; do not advertise the three-day trial as live. Customer create uses companyName/timezone with JWT-derived identity; bootstrap returns memberships and the frontend selects the new ID. Tests cover two workspaces for one account, tenant isolation, retry safety, report authorization and count reconciliation.

Foundation/runtime, media/workflow/client, frontend, lifecycle and composer tests passed. n8n editor showed Published, enabled customer queue and private media signing nodes; no workflow changes or executions triggered. Production website failed with connection reset from browser and direct request, so the uploaded frontend version and live customer/media flow could not be verified. Latest frontend package upload status remains unconfirmed; no production-perfect claim is made.

Use backend/supabase/v2-review/admin-usage-query.sql in Supabase SQL Editor for user rows and nested workspace/campaign summaries. No new customer dashboard/admin page was added. Full check remains open for production URL access and an authorized end-to-end send/attachment test.
