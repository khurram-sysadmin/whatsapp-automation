# Supabase schema and campaign lifecycle

## Installation and migration history

Versioned SQL is in `backend/supabase/`:

1. `001-base.sql`: private outreach schema, original queue/API functions, service-role public RPC wrappers, RLS.
2. `002-production-hardening.sql`: preserved original API/stats functions, archive column, contacts/suppression/template actions, real dashboard totals, idempotent archive actions.
3. `003-campaign-lifecycle.sql`: immediate completion trigger, terminal Completed behavior, stale-control success, repeat-safe archive/delete.

All are already applied to the current project. Do not rerun the base schema over a working deployment: it replaces functions and is intended for a fresh install. For a new project run 001, 002, 003 in that order as owner. For this existing project apply only new unapplied migrations. Back up first. The lifecycle rollback file restores the preceding API and removes its new trigger/helper/index; it does not restore archived campaigns or undo historical status changes.

## Tables

| Table in outreach | Purpose |
| --- | --- |
| campaigns | Template, window/timezone, interval, next-send time, status/timestamps, deleted_at |
| contacts | Campaign-scoped normalized recipient records, unique campaign/phone |
| messages | One per contact, personalized body, queue status, lease, attempts, provider IDs/aliases/timestamps/errors |
| message_attempts | Immutable per-message/attempt outcome records |
| suppression_list | Unique globally suppressed phones and reasons |
| replies | Deduplicated provider reply IDs and attributed campaign/contact |
| webhook_events | Durable event intake, processing state, unmatched event retries |
| api_requests | requestId/body/response for idempotent writes; conflicts rejected |
| templates | Named reusable template bodies |
| sender_settings | Singleton sender gate, global minimum interval, next-send time |

Keep outreach outside Supabase exposed schemas. RLS and revokes deny public table access. Public `eb_outreach_*` RPC functions are service-role only; private API/helper functions deny PUBLIC/anon/authenticated. Do not expose the service-role key to browser code.

## RPC contract

`eb_outreach_api(p)` returns `{result: {...}}`; n8n unwraps it for the frontend. Other wrappers: `eb_outreach_claim_next`, `eb_outreach_begin_send`, `eb_outreach_finish_send`, `eb_outreach_ingest_events`, `eb_outreach_process_events`, `eb_outreach_maintenance`.

Read actions: health, list, detail, stats, messages, replies, templates, contacts, suppressions. Write actions: create, import, start, pause, resume, stop, delete, saveTemplate, deleteTemplate, suppress. Write requests require requestId length 8–128; campaign-scoped actions require a UUID. Reusing a request ID with different content is rejected. Pagination is bounded to 200 rows per page; the frontend gathers pages for collections.

## State machine

`draft -> running -> completed`; `running <-> paused`; running/paused can become stopped. Only drafts can start. Import is draft-only. Completed is terminal: new Start returns 409 and asks for a new campaign. Stale Pause/Resume/Stop on Completed succeeds while preserving Completed, avoiding a race with the final send.

`complete_campaign_after_message` runs after a changed message status and calls `complete_finished_campaign`. A started, non-archived running/paused campaign completes when no queued, leased or dispatching messages remain. A one-time reconciliation also updates existing finished active campaigns. Completed means sending work finished, not that every recipient received/read the message. Failed/unknown messages remain recorded. Unknown outcomes do not auto-resend and remain available for reconciliation.

Delete sets deleted_at, hides the campaign and its associated dashboard records, and cancels queued/leased messages. It retains contacts/messages/attempts/events for auditing and late provider events. It does not physically delete them. Unknown/in-flight outcomes no longer block archiving of a paused/stopped/completed campaign. In-flight sends cannot be recalled. Running campaigns with pending work still require Pause or Stop. Same or new request-ID repeat deletes succeed; other actions on archived campaigns return 404.

## Worker guarantees

Existing advisory transaction lock `824601` serializes queue/state operations. Only one global leased/dispatching message is allowed. Lease is two minutes; dispatch lease five minutes. Final pre-send check repeats sender gate, campaign state, time window, cooldown and suppression checks. Sender defaults disabled on a fresh schema; do not change the live gate as part of unrelated repairs.

Provider 429 retries use delayed queued work, max three attempts, normally 300/900 seconds or a larger Retry-After. Known permanent rejections fail. Transport/5xx/malformed success are unknown and must not be auto-resubmitted. Provider IDs are required before accepted success. Expired dispatches become unknown; expired undispatched leases can recover. Receipt processing matches IDs/aliases; unmatched events retry and are retained. Opt-outs suppress globally and cancel pending work.

The claim/begin/finish send logic was preserved by these repairs. The verified claim_next definition MD5 was `d8872888881aeaaf2cc9fc329b81c764`; use only as a snapshot comparison, not proof of future behavior.
