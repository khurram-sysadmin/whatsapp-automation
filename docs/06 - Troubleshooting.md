# Troubleshooting

| Symptom | Likely cause | Check / fix |
| --- | --- | --- |
| White page after upload | Source uploaded instead of build, nested dist folder, missing assets, wrong index | Check root index.html and its asset references, browser console/network, .htaccess and document root |
| Unable to connect / setup incomplete | Private config discovery, PHP extensions, directory permissions, origin/HTTPS | Check PHP/server logs privately, external private directory and curl/pdo_sqlite/mbstring |
| Connect n8n in Settings | No stored key | Save existing Frontend Auth credential value, then Test Connection |
| API verified but database fails | Supabase credential/project URL/RPC/schema problem | Inspect Execute Campaign Action and Supabase account 2; check migration state |
| API/Supabase pass but import authorization fails | API and Upload Contacts use different/wrong header credentials | Map both to existing EightBit Frontend Auth; do not use MCP token |
| Connected once then key appeared lost | Old PHP config-based persistence/OPcache or old browser-only settings | Deploy current SQLite-based connection edition; blank saves preserve existing key |
| n8n auth error signs user out | Old proxy propagated backend 401 | Current proxy maps upstream auth failure to connection error; admin session should remain valid |
| Admin session genuinely expires | Idle/absolute timeout or changed password | Sign in again; this is separate from backend connection persistence |
| Delete Action Failed with unresolved outcome | Pre-lifecycle archive guard | Confirm migration 003 installed; archive retains audit data instead of blocking unknown/in-flight records |
| Delete succeeds but error or campaign reappears | Lost response or older list refresh | Deploy campaign-fix frontend; it checks 404 after uncertain write and drains old refresh |
| Stop fails after sending finishes | Completed backend plus stale running page | Current backend returns success with Completed; current UI refreshes controls every five seconds |
| Completed shows Start/Resume | Old/mismatched UI or status data | Check exact live bundle and detail result; backend rejects new Start on Completed |
| Campaign stays running with no active messages | Missing completion trigger/helper or unapplied migration | Verify trigger and current api/helper; distinguish queued retries and leased/dispatching work |
| Queued campaign sends nothing | Sender disabled, outside window, cooldown, paused, suppression, credentials | Read sender_settings, campaign window/timezone/next_send_at and worker execution; do not enable blindly |
| Sent but not Delivered/Read | Provider accepted without receipt, webhook auth/ID mismatch | Inspect provider logs, authenticated webhook intake, webhook_events and IDs/aliases; do not resend automatically |
| Unknown/needs review | Transport ambiguity or interrupted dispatch | Reconcile provider logs; never equate unknown with safe-to-resend |
| Opt-out recipient still queued | Event ingestion/suppression mismatch | Verify normalized phone, suppression_list, pending event processing and final pre-send check |

Read-only diagnostic SQL (owner SQL editor):

```sql
SELECT id,name,status,deleted_at,started_at,completed_at FROM outreach.campaigns ORDER BY created_at DESC;
SELECT campaign_id,status,count(*) FROM outreach.messages GROUP BY campaign_id,status;
SELECT enabled,min_interval_seconds,next_send_at FROM outreach.sender_settings;
SELECT status,count(*) FROM outreach.webhook_events GROUP BY status;
SELECT tgname FROM pg_trigger WHERE tgrelid='outreach.messages'::regclass AND NOT tgisinternal;
SELECT outreach.api('{"action":"stats"}'::jsonb);
```

Do not publish query results containing customer phones, message bodies or credential material. n8n executions can be marked success while the returned API result contains success:false; inspect the response body/httpStatus and the frontend network response, not execution status alone. A currently completed campaign was verified through n8n execution 5903: stale Stop returned success:true/status:completed.
