# SaaS v2 frontend requirements


Only after the Supabase foundation exists and Codex has implemented the v2 backend, give your frontend developer this:

> **EightBit Outreach — SaaS v2 Production Frontend**
>
> Convert the existing working frontend into the final multi-tenant SaaS frontend.
>
> DO NOT use the old v1 API.
>
> Production:
>
> ```text
> https://wamarketing.eightbitsolutions.com
> ```
>
> API:
>
> ```text
> https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/api
> ```
>
> Import:
>
> ```text
> https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/import
> ```
>
> ### Environment variables
>
> Use EXACTLY:
>
> ```env
> VITE_SUPABASE_URL=
> VITE_SUPABASE_PUBLISHABLE_KEY=
> VITE_OUTREACH_API_URL=
> VITE_OUTREACH_IMPORT_URL=
> VITE_APP_URL=https://wamarketing.eightbitsolutions.com
> VITE_DEFAULT_TIMEZONE=Asia/Karachi
> ```
>
> Never create:
>
> ```text
> VITE_SUPABASE_SECRET_KEY
> VITE_WASENDER_KEY
> VITE_OUTREACH_KEY
> ```
>
> ### API authentication
>
> Use Supabase Auth.
>
> Before every n8n v2 request:
>
> ```ts
> const {
>   data: { session }
> } = await supabase.auth.getSession();
> ```
>
> Send:
>
> ```http
> Authorization: Bearer <session.access_token>
> Content-Type: application/json
> ```
>
> Never send browser `userId` as authorization proof.
>
> ### Exact field contract
>
> Use these variables and no alternatives:
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
> name
> firstName
> displayName
> timezone
> sendingStartTime
> sendingEndTime
> sendIntervalSeconds
> deletedAt
> ```
>
> ### Authentication pages
>
> Build:
>
> ```text
> /signup
> /login
> /forgot-password
> /reset-password
> ```
>
> Use Supabase Auth.
>
> Signup fields:
>
> ```text
> fullName
> email
> password
> confirmPassword
> ```
>
> After signup/email verification call:
>
> ```json
> {
>   "action": "bootstrap"
> }
> ```
>
> If user has no workspace, launch onboarding.
>
> ### Onboarding
>
> Professional four-step wizard:
>
> ```text
> Company
> → WhatsApp
> → Test
> → Ready
> ```
>
> Company request:
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
> Persist returned:
>
> ```text
> workspaceId
> ```
>
> Do not generate a local workspace ID.
>
> ### WhatsApp step
>
> Page:
>
> ```text
> Connect your WhatsApp
> ```
>
> Display existing sessions.
>
> Session card fields:
>
> ```text
> displayName
> phoneE164
> status
> isDefault
> ```
>
> Button:
>
> ```text
> + Add WhatsApp Account
> ```
>
> Until backend returns a real QR, do not generate fake QR data.
>
> If backend returns:
>
> ```text
> PROVIDER_NOT_CONFIGURED
> ```
>
> show a professional setup-pending message.
>
> When partner API becomes active, display returned QR directly in this page without changing frontend contracts.
>
> ### Application navigation
>
> Build:
>
> ```text
> Dashboard
> Campaigns
> Contacts
> Inbox
> WhatsApp Accounts
> Templates
> Analytics
> Team
> Billing
> Settings
> ```
>
> ### Header
>
> Display:
>
> ```text
> companyName
> fullName
> current WhatsApp connection status
> ```
>
> Workspace name must come from backend.
>
> ### Dashboard
>
> KPI cards:
>
> ```text
> WhatsApp Accounts
> Active Campaigns
> Total Contacts
> Queued
> Sent
> Delivered
> Read
> Replied
> Failed
> Opted Out
> ```
>
> Sections:
>
> ```text
> Recent Campaigns
> Recent Conversations
> Message Performance
> WhatsApp Account Status
> Monthly Usage
> ```
>
> Missing numeric data renders `0`.
>
> Never render:
>
> ```text
> undefined
> NaN
> null
> ```
>
> ### Campaign creation
>
> Fields:
>
> ```text
> name
> whatsappSessionId
> template
> timezone
> sendingStartTime
> sendingEndTime
> sendIntervalSeconds
> ```
>
> `whatsappSessionId` is mandatory.
>
> Only show sessions where:
>
> ```text
> status === "connected"
> ```
>
> Exact request:
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
> Store returned `campaignId`.
>
> Never generate fake/local campaign IDs.
>
> ### Campaign statuses
>
> Frontend supports ONLY:
>
> ```text
> draft
> running
> paused
> stopped
> completed
> ```
>
> Deletion uses:
>
> ```text
> deletedAt
> ```
>
> ### Campaign actions
>
> ```text
> draft:
> Start / Delete
>
> running:
> Pause / Stop
>
> paused:
> Resume / Stop / Delete
>
> stopped:
> Delete
>
> completed:
> Delete
> ```
>
> Delete requires confirmation.
>
> ### Import
>
> URL:
>
> ```text
> VITE_OUTREACH_IMPORT_URL
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
> multipart:
>
> ```text
> file
> ```
>
> Do NOT manually set multipart `Content-Type`.
>
> Excel/CSV fields remain:
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
> ### Contacts page
>
> Display:
>
> ```text
> name
> firstName
> company
> phoneE164
> email
> city
> industry
> status
> ```
>
> Search by:
>
> ```text
> name
> company
> phoneE164
> email
> ```
>
> ### Inbox
>
> Replace the old replies screen.
>
> Conversation list:
>
> ```text
> Ali Khan
> ABC Restaurant
> +92 333 1234567
> Can you send me pricing?
> 2m ago
> ```
>
> Do NOT display only a number when contact information exists.
>
> Conversation panel shows inbound/outbound bubbles.
>
> Reply request:
>
> ```json
> {
>   "action": "reply",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "conversationId": "UUID",
>   "text": "Sure, I can share pricing."
> }
> ```
>
> Do not send phone/session from frontend for replies.
>
> ### Multiple WhatsApp accounts
>
> Page:
>
> ```text
> WhatsApp Accounts
> ```
>
> Example:
>
> ```text
> Karachi Sales
> +92 333 xxx xxxx
> Connected
>
> Lahore Sales
> +92 300 xxx xxxx
> Connected
>
> [+ Add WhatsApp Account]
> ```
>
> Campaign creation must allow choosing one.
>
> ### Billing
>
> Read backend subscription:
>
> ```text
> planCode
> status
> whatsappSessionLimit
> teamMemberLimit
> contactLimit
> monthlyMessageLimit
> ```
>
> Do not hardcode plan enforcement in frontend.
>
> Backend remains authoritative.
>
> ### Settings
>
> Build:
>
> ```text
> Profile
> Company
> Security
> WhatsApp Accounts
> Team
> Billing
> ```
>
> Change password directly through Supabase Auth.
>
> ### Error handling
>
> Application must never display a blank page.
>
> Keep AppShell mounted.
>
> Use:
>
> ```text
> loading state
> inline API error
> toast
> ErrorBoundary
> ```
>
> Normalize every backend response.
>
> No unsafe:
>
> ```ts
> value.toLowerCase()
> ```
>
> Use:
>
> ```ts
> String(value ?? '').toLowerCase()
> ```
>
> where appropriate.
>
> ### Polling
>
> No duplicate polling timers.
>
> Dashboard:
>
> ```text
> 30–60 second refresh
> ```
>
> Running campaign:
>
> ```text
> approximately 10–15 second refresh
> ```
>
> Completed/stopped campaign:
>
> no aggressive polling.
>
> Cleanup all timers on unmount.
>
> ### Source of truth
>
> Backend is authoritative.
>
> Do not store fake campaigns, fake message counts or fake statuses in localStorage.
>
> localStorage may contain only non-sensitive UI preferences.
>
> ### Final build
>
> Generate:
>
> ```text
> WhatsApp-Automation-SaaS-cPanel-ready.zip
> ```
>
> with production build:
>
> ```text
> index.html
> assets/
> .htaccess
> favicon.svg
> icons.svg
> logo.jpg
> ```
>
> No API secrets.
>
> Test:
>
> ```text
> Signup
> Login
> Verify email
> Create company
> Dashboard isolation
> Multiple workspaces where supported
> WhatsApp Accounts
> Create campaign
> Upload
> Start
> Pause
> Resume
> Stop
> Delete
> Message history
> Contact name/company
> Inbox
> Reply
> Password change
> Logout
> Login
> Page refresh
> Mobile
> API unavailable
> ```
>
> Do not mark any test passed unless actually tested.

---
