# n8n workflow and credentials

One existing workflow: EightBit WhatsApp Outreach (`biQP0tU694qWD8P9`), 41 nodes, published version `50d243e9-9283-41af-86e8-f2eb1e18cb88` checked 2026-09-30. Export: `backend/n8n/eightbit-whatsapp-outreach.json`; exported inactive so importing it does not start a duplicate sender. Prefer updating the existing workflow. Credential values are excluded; credential reference IDs/names are retained.

## Entry points

| Trigger | Production endpoint / behavior |
| --- | --- |
| Campaign API | POST https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api |
| Upload Contacts | POST https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/import; multipart file |
| Verified WASender Events | POST https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/wasender |
| Every 15 Seconds | Scheduled maintenance/event/claim/send worker |
| Manual Setup and Validation | Logic self-tests, not a substitute for full live delivery proof |

Supabase API Configuration embeds only the project URL and picks route by executed trigger. Route API and Worker dispatches API/upload/provider/worker branches.

API flow: Campaign API -> Supabase configuration/routing -> Validate API Request -> Request Valid -> Execute Campaign Action -> Sanitize Database Error -> Return Campaign JSON. Upload flow validates file/request, chooses CSV/Excel extraction, normalizes contacts, invokes import RPC, returns real result. Provider flow verifies header credential, normalizes safe event data, persists and applies opt-outs before acknowledging. Worker recovers queue/completes campaigns, applies status/reply events, claims one eligible message, performs final state/suppression check, calls WASender, classifies response, persists outcome. Inspect the exported connections for exact wiring.

## Credential references (not secret values)

| n8n credential | Reference ID | Use |
| --- | --- | --- |
| EightBit Frontend Auth | pUnMrd7WnZQGLDCa | Campaign API and Upload Contacts, HTTP header auth using X-Outreach-Key |
| Supabase account 2 | xscPJkx7lM0aZoWi | All eight Supabase HTTP/RPC nodes |
| WASender API Auth | uN2q5kquAgYEACX6 | Send WhatsApp via WASender |
| WASender Webhook Auth | DP1GePTQdd7Ca7Mh | Verified WASender Events |

The site's saved key must equal the existing EightBit Frontend Auth credential value. Supabase service key stays in Supabase account 2. Provider API and webhook auth stay in their own credentials. n8n MCP access tokens are for administration and are not any of these values. Never paste keys into GitHub, Obsidian, logs, frontend env variables or workflow code.

## Publication and recovery

Export is a snapshot, not a live backup of credentials or database data. Restoring it in another n8n instance requires recreating/mapping credentials, verifying the project URL, registering the correct authenticated provider webhook, applying SQL and publishing deliberately. Do not leave two scheduled copies active. A draft edit does not affect production until published. The connection repair published only Campaign API authentication and Validate API Request action support; sending nodes/connections were unchanged. The lifecycle fix was SQL-only in the live backend.
