# Architecture and service map

## SaaS upgrade — 2026-10-03

The new frontend is built and reviewed at the local preview; the production frontend still uses v1. Supabase Auth supplies the user's JWT. n8n verifies it before calling service-only Supabase RPCs; database membership and roles scope every company action. Customers enter only their own WASender session keys through the dashboard. Multiple connections are supported; Vault holds their secrets, and each send uses the selected connection's key. The six private v2 queue tables are inaccessible to browser roles.

The existing workflow `biQP0tU694qWD8P9` now has 92 nodes: 41 preserved v1 nodes and 51 v2 additions. It reuses the existing Supabase credential. The customer schedule was enabled with explicit approval on 2026-10-04; v1 sending remains unchanged. The first approved message was accepted and its campaign completed automatically. No second workflow was created. Separate v2 queues prevent v1 from claiming customer messages. V1 history remains in the original tables and dashboard; presentation and owner-number cutover are still pending.

Current source remote: https://github.com/khurram-sysadmin/whatsapp-automation.git. See [current verification](saas-v2/frontend-validation.md), [deployment](saas-v2/deployment.md), [runtime](saas-v2/runtime-review.md), and `saas-v2/progress.json`. The map below documents the retained v1 edition.

Updated: 2026-09-30. Product: EightBit WhatsApp Outreach / WhatsApp Automation. This is distinct from the ERPNext POS receipt automation and Carnivore voice agent.

## System boundaries

```mermaid
flowchart LR
 B[React dashboard] -->|Same-origin HTTPS + admin session + CSRF| P[PHP API on cPanel]
 P -->|X-Outreach-Key| N[Single n8n workflow]
 N -->|Server-side Supabase credential / RPC| D[Supabase outreach schema]
 N -->|Provider credential| W[WASender API]
 W -->|Authenticated status/reply webhook| N
```

| Component | Current identity | Responsibility |
| --- | --- | --- |
| Dashboard | https://wamarketing.eightbitsolutions.com | Campaign UI, contacts, templates, replies, suppression, settings |
| GitHub | https://github.com/khurram-sysadmin/whatsaoo-automation | Source, migrations, workflow export, release ZIP, documentation |
| n8n | https://n8n.eightbitsolutions.com | API validation, imports, queue worker, provider sends/events |
| Workflow | EightBit WhatsApp Outreach, ID `biQP0tU694qWD8P9` | One workflow, 41 nodes |
| Supabase | https://lreolnewuapcurpskqwr.supabase.co | Campaign and message persistence, RPC transactions |
| SQL editor | https://supabase.com/dashboard/project/lreolnewuapcurpskqwr/sql | Owner-managed schema changes |
| Provider | https://www.wasenderapi.com/api/send-message | WhatsApp sending |

Workflow published version verified on 2026-09-30: `50d243e9-9283-41af-86e8-f2eb1e18cb88`. The lifecycle repair changed database functions, not the workflow graph. Recheck these identifiers and runtime state before later changes.

The browser does not directly call Supabase or n8n. Supabase's secret key belongs in n8n. The browser receives connection status, never stored secret values. The private PHP database contains only administrator/auth/session-related state, preferences and backend connection settings; it is not the campaign database.

## Source of truth

Code is in GitHub; actual runtime behavior depends on the uploaded cPanel build, published n8n graph, applied Supabase functions, and existing credentials. A Git push alone does not deploy any of those services. Supabase is accessed through HTTPS RPC, not a PostgreSQL connection credential. Obsidian is an operational guide, not a secret store.

## Customer sender activation — 2026-10-04

Resolved the pending campaign: the published v2 customer schedule was disabled from the earlier deferred provider test. Read-only checks found one queued message, zero attempts, and ready connection/key/sender/window metadata. No other queued campaign, standalone message or in-flight/unknown message was present. The user explicitly authorized the selected recipient test.

Enabled only V2 Customer Queue Every 15 Seconds in the existing 92-node workflow biQP0tU694qWD8P9 and published version 1af85b6e-5bfa-41ef-81ee-197106cc0af0. Read-back confirmed active workflow and enabled customer schedule. The message reached sent with one attempt and provider acknowledgement; its campaign automatically reached completed without error. Recipient delivery/read status and signed callbacks are not yet verified. No frontend or cPanel package changed.

Import templates remain inactive with the customer schedule disabled intentionally. The published sender is now enabled; review settings before any reimport. See repository docs/saas-v2/sender-activation-2026-10-04.md and progress.json for the current checkpoint. Earlier deferred-activation notes are historical.
