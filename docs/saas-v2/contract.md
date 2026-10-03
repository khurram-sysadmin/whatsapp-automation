# SaaS v2 frozen contract


Give **both frontend and backend developers this exact contract**. Do not allow either side to rename these variables.

### Frontend/API JSON = camelCase

| Purpose | Exact variable |
|---|---|
| Auth user | `userId` |
| Workspace | `workspaceId` |
| Company | `companyName` |
| WhatsApp account | `whatsappSessionId` |
| Provider account | `providerAccountId` |
| Campaign | `campaignId` |
| Contact | `contactId` |
| Conversation | `conversationId` |
| Request ID | `requestId` |
| Phone | `phoneE164` |
| Name | `name` |
| First name | `firstName` |
| Display name | `displayName` |
| Timezone | `timezone` |
| Start time | `sendingStartTime` |
| End time | `sendingEndTime` |
| Interval | `sendIntervalSeconds` |
| Deleted timestamp | `deletedAt` |

### PostgreSQL = snake_case

```text
user_id
workspace_id
company_name
whatsapp_session_id
provider_account_id
campaign_id
workspace_contact_id
conversation_id
request_key
phone_e164
first_name
display_name
sending_start_time
sending_end_time
send_interval_seconds
deleted_at
```

### API URLs

Keep v1 untouched:

```text
https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api
https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/import
```

Build new SaaS API:

```text
https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/api

https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/import

https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/provider-webhook
```

### Standard response

Every v2 endpoint:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "requestId": "req_xxxxxxxx"
}
```

Errors:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Human readable message"
  },
  "requestId": "req_xxxxxxxx"
}
```

---


## Backend contract


Now give Codex this exact prompt.

> **EightBit Outreach SaaS v2 — n8n Backend**
>
> I already have a working production n8n workflow named `EightBit WhatsApp Outreach`.
>
> DO NOT modify, remove or break the existing v1 routes or existing working campaign worker.
>
> Existing v1 must remain operational while v2 is developed.
>
> Keep everything in ONE n8n workflow.
>
> Add three new branches:
>
> ```text
> POST /eightbit-outreach/v2/api
> POST /eightbit-outreach/v2/import
> POST /eightbit-outreach/v2/provider-webhook
> ```
>
> Production hostname:
>
> ```text
> https://n8n.eightbitsolutions.com
> ```
>
> Frontend:
>
> ```text
> https://wamarketing.eightbitsolutions.com
> ```
>
> ### CRITICAL CONTRACT
>
> Browser/API JSON uses camelCase only.
>
> Use EXACTLY:
>
> ```text
> userId
> workspaceId
> companyName
> whatsappSessionId
> providerAccountId
> campaignId
> contactId
> conversationId
> requestId
> phoneE164
> displayName
> timezone
> sendingStartTime
> sendingEndTime
> sendIntervalSeconds
> deletedAt
> ```
>
> PostgreSQL uses snake_case internally.
>
> Do not return raw snake_case database objects to the frontend. Map responses to camelCase.
>
> ### AUTHENTICATION
>
> v2 does NOT use `X-Outreach-Key`.
>
> Every frontend request carries:
>
> ```http
> Authorization: Bearer <SUPABASE_USER_ACCESS_TOKEN>
> ```
>
> The Webhook node itself may use no static Header Auth because authentication is dynamic.
>
> Immediately after the webhook:
>
> 1. Require `Authorization`.
> 2. Require `Bearer`.
> 3. Extract JWT.
> 4. Validate JWT using:
>
> ```text
> GET https://lreolnewuapcurpskqwr.supabase.co/auth/v1/user
> ```
>
> headers:
>
> ```text
> apikey: SUPABASE_PUBLISHABLE_KEY
> Authorization: Bearer <USER_JWT>
> ```
>
> 5. HTTP 200 means valid user.
> 6. Derive `userId` exclusively from returned Supabase user `id`.
> 7. NEVER trust a browser supplied `userId`.
> 8. Return 401 before any database operation if validation fails.
>
> Supabase documents `/auth/v1/user` with a publishable `apikey` plus the user's Bearer JWT as a valid server-side verification method.
>
> ### SUPABASE BACKEND CREDENTIAL
>
> Create a new n8n backend credential:
>
> ```text
> Supabase SaaS Backend
> ```
>
> Use:
>
> ```text
> Host:
> https://lreolnewuapcurpskqwr.supabase.co
>
> Secret:
> sb_secret_...
> ```
>
> Do not change the v1 `Supabase account 2` credential.
>
> Do not expose the secret to frontend.
>
> ### STANDARD RESPONSE
>
> Every v2 response MUST be:
>
> ```json
> {
>   "success": true,
>   "data": {},
>   "error": null,
>   "requestId": "..."
> }
> ```
>
> Failure:
>
> ```json
> {
>   "success": false,
>   "data": null,
>   "error": {
>     "code": "ERROR_CODE",
>     "message": "Readable message"
>   },
>   "requestId": "..."
> }
> ```
>
> ### WORKSPACE AUTHORIZATION
>
> After JWT validation, every request containing `workspaceId` must verify:
>
> ```text
> workspace_members.workspace_id = workspaceId
> workspace_members.user_id = authenticated userId
> ```
>
> Also load role:
>
> ```text
> owner
> admin
> agent
> viewer
> ```
>
> Never authorize a request simply because the browser supplied a valid UUID.
>
> ### ACTIONS
>
> Support EXACTLY:
>
> ```text
> bootstrap
> workspaceCreate
> workspaceUpdate
> profileUpdate
>
> sessionList
> sessionCreate
> sessionConnect
> sessionStatus
> sessionDisconnect
> sessionDelete
>
> create
> list
> detail
> start
> pause
> resume
> stop
> delete
> stats
> messages
> contacts
>
> templates
> saveTemplate
> suppress
>
> inbox
> conversation
> reply
> markConversationRead
>
> subscription
> usage
> health
> ```
>
> Every write action requires:
>
> ```text
> requestId
> ```
>
> Require 8–128 characters.
>
> Use `outreach.api_requests_v2` for idempotency.
>
> ### BOOTSTRAP
>
> Request:
>
> ```json
> {
>   "action": "bootstrap"
> }
> ```
>
> Return:
>
> ```json
> {
>   "user": {
>     "userId": "...",
>     "email": "...",
>     "fullName": "..."
>   },
>   "workspaces": [],
>   "currentWorkspaceId": null,
>   "providerMode": "pending_partner"
> }
> ```
>
> Workspace object:
>
> ```json
> {
>   "workspaceId": "UUID",
>   "companyName": "EightBit Solutions",
>   "timezone": "Asia/Karachi",
>   "status": "active",
>   "role": "owner",
>   "onboardingStep": "complete"
> }
> ```
>
> ### WORKSPACE CREATE
>
> Request:
>
> ```json
> {
>   "action": "workspaceCreate",
>   "requestId": "req_xxxxxxxx",
>   "companyName": "ABC Company",
>   "timezone": "Asia/Karachi"
> }
> ```
>
> Backend must:
>
> 1. derive userId from JWT
> 2. validate timezone
> 3. create workspace
> 4. create workspace_members role owner
> 5. create beta subscription
> 6. return `workspaceId`
>
> ### WHATSAPP SESSIONS
>
> Canonical session response:
>
> ```json
> {
>   "whatsappSessionId": "UUID",
>   "displayName": "Karachi Sales",
>   "phoneE164": "+923331234567",
>   "status": "connected",
>   "isDefault": true
> }
> ```
>
> A workspace may have multiple sessions.
>
> While WASender partner approval is pending:
>
> - preserve the existing legacy EightBit WhatsApp session
> - build all session database/UI logic
> - keep partner provisioning behind a provider adapter
> - DO NOT fake successful QR provisioning
> - return a clear `PROVIDER_NOT_CONFIGURED` response if partner credentials are required but unavailable
>
> Provider interface:
>
> ```text
> createSession()
> connectSession()
> getSessionStatus()
> disconnectSession()
> deleteSession()
> sendMessage()
> ```
>
> When partner credentials arrive, implement these methods without changing frontend contracts.
>
> ### CAMPAIGN CREATE
>
> Request EXACTLY:
>
> ```json
> {
>   "action": "create",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "whatsappSessionId": "UUID",
>   "name": "Restaurant Outreach",
>   "template": "Hi {{first_name}}, ...",
>   "timezone": "Asia/Karachi",
>   "sendingStartTime": "09:00",
>   "sendingEndTime": "17:00",
>   "sendIntervalSeconds": 120
> }
> ```
>
> Validate:
>
> - workspace membership
> - workspace active
> - selected session belongs to workspace
> - session connected
> - campaign fields
> - timezone
> - interval
>
> Save:
>
> ```text
> workspace_id
> whatsapp_session_id
> created_by
> ```
>
> ### CAMPAIGN STATUS
>
> Do not change the existing status values:
>
> ```text
> draft
> running
> paused
> stopped
> completed
> ```
>
> Delete is represented by:
>
> ```text
> deleted_at
> ```
>
> not a `deleted` status.
>
> `list`, `stats`, etc. must exclude `deleted_at IS NOT NULL`.
>
> ### IMPORT
>
> Endpoint:
>
> ```text
> POST /eightbit-outreach/v2/import
> ```
>
> Query:
>
> ```text
> workspaceId
> campaignId
> requestId
> ```
>
> Multipart field:
>
> ```text
> file
> ```
>
> Accept CSV/XLSX using the existing validation logic.
>
> Existing supported spreadsheet fields:
>
> ```text
> name
> first_name
> company
> phone
> email
> city
> industry
> ```
>
> The frontend may display `firstName`, but spreadsheet compatibility remains `first_name`.
>
> During import:
>
> 1. verify workspace membership
> 2. verify campaign belongs to workspace
> 3. require draft status
> 4. normalize phone
> 5. upsert `outreach.workspace_contacts`
> 6. create campaign-scoped `outreach.contacts`
> 7. set `workspace_id`
> 8. set `workspace_contact_id`
> 9. respect `workspace_suppressions`
>
> ### WORKER
>
> Do NOT use one customer's provider credentials for another.
>
> Each claimed message must carry:
>
> ```text
> messageId
> workspaceId
> campaignId
> whatsappSessionId
> contactId
> phoneE164
> personalizedMessage
> ```
>
> The v2 worker must enforce:
>
> - workspace active
> - subscription allowed
> - campaign running
> - session connected
> - session sender enabled
> - session next_send_at due
> - campaign next_send_at due
> - campaign sending window
> - message scheduled_at due
> - recipient not suppressed in that workspace
>
> Keep existing retry/lease/unknown-outcome safety behavior.
>
> Current v1 uses a single global sender and prevents another send while any message is leased/dispatching. Do not use that global serialization model for different SaaS customer sessions.
>
> For v2, concurrency boundary must be:
>
> ```text
> one active dispatch per whatsappSessionId
> ```
>
> Different WhatsApp sessions may independently dispatch.
>
> ### INBOX
>
> `inbox` response:
>
> ```json
> {
>   "conversationId": "UUID",
>   "whatsappSessionId": "UUID",
>   "contact": {
>     "contactId": "UUID",
>     "name": "Ali Khan",
>     "firstName": "Ali",
>     "company": "ABC Restaurant",
>     "phoneE164": "+923331234567"
>   },
>   "lastMessage": "Can you send pricing?",
>   "lastMessageAt": "...",
>   "unreadCount": 1
> }
> ```
>
> ### REPLY
>
> Request:
>
> ```json
> {
>   "action": "reply",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "conversationId": "UUID",
>   "text": "Sure, here are the details."
> }
> ```
>
> NEVER accept phone or whatsappSessionId from the reply form as authoritative.
>
> Backend must derive:
>
> ```text
> workspaceContact
> phoneE164
> whatsappSessionId
> ```
>
> from the conversation.
>
> Send through that session.
>
> Persist outbound conversation message.
>
> ### INBOUND WEBHOOKS
>
> Provider webhook must resolve provider session → `whatsappSessionId` → `workspaceId`.
>
> Create/update:
>
> ```text
> workspace_contacts
> conversations
> conversation_messages
> ```
>
> Update delivery/read status.
>
> Maintain opt-out handling per workspace using:
>
> ```text
> outreach.workspace_suppressions
> ```
>
> Do not use the old global suppression table for v2.
>
> ### CONTACT DISPLAY
>
> Backend should return:
>
> ```text
> name
> firstName
> company
> phoneE164
> ```
>
> not only phone.
>
> ### DELETE CAMPAIGN
>
> `delete` is soft delete.
>
> For running campaigns require stop first.
>
> Set:
>
> ```text
> deleted_at = now()
> ```
>
> Keep historical messages and delivery data.
>
> ### SECURITY
>
> Never log:
>
> - user JWT
> - Supabase secret key
> - partner token
> - WASender API key
> - provider webhook secret
>
> Do not return provider credentials to browser.
>
> ### OUTPUT
>
> Produce:
>
> 1. updated n8n workflow JSON
> 2. exact node-by-node change report
> 3. `supabase-v2-runtime.sql` containing ONLY new v2 database functions/RPC wrappers
> 4. API contract document
> 5. test payloads for every action
> 6. migration/rollback notes
>
> Do NOT replace existing v1 functions such as:
>
> ```text
> outreach.api
> outreach.claim_next
> outreach.begin_send
> outreach.finish_send
> outreach.ingest_events
> outreach.process_events
> outreach.maintenance
> ```
>
> Create separate `_v2` functions.
>
> Do not touch the working v1 public RPC wrappers.
>
> Before declaring complete, test v1 and v2 independently.

Your current workflow's scheduled branch is one 15-second scheduler with Supabase handling timing/retries. Pasted text The v2 implementation should preserve that safety philosophy but make pacing/session locks tenant-aware.

---
