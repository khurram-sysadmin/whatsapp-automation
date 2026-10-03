# Customer connection wizard — frontend specification

Status: implemented in the reviewed local frontend and upload build. Not uploaded to production. The user deferred real WASender connection, delivery and callback testing; these wizard steps are not claimed as exercised against a real provider. Imported legacy connections show Setup required and cannot be modified as customer-key connections.

The company sees only its own connections. Company owners/admins can add several numbers; campaign creation selects one configured connection. n8n and Supabase stay operator-managed and never appear as customer credential fields.

## Step 1 — Company
Sign in to EightBit, confirm the company name and timezone. Show progress: Company → WhatsApp connection → Webhook → Test → Ready.

## Step 2 — Connect the number in WASender
Open the customer's WASender dashboard privately, sign in/create an account, create a WhatsApp session and link the phone using WASender's QR flow. Wait until connected. Do not generate an imitation QR inside EightBit.

## Step 3 — Add the connection
Enter a friendly connection name, paste that session's API key and enter a unique webhook secret for this connection. Use the session API key, not an account Personal Access Token. EightBit verifies the real status and phone on the server before saving the connection. Show the verified phone for confirmation. Keys stay in form memory only until submission, are cleared after success and never enter localStorage, URLs or read responses.

[WASender session-key authentication](https://api.wasenderapi.com/api-docs/authentication/how-to-authenticate-api-requests-using-bearer-tokens), [connection status](https://api.wasenderapi.com/api-docs/sessions/get-whatsapp-session-status), [verified session identity](https://api.wasenderapi.com/api-docs/sessions/get-session-user-info).

## Step 4 — Enable callbacks
Copy the session-specific webhook URL shown by EightBit into this WASender session's webhook settings. Enter the same webhook secret, enable message/status/session events and save. EightBit displays whether a verified callback has arrived. Do not expose the secret again after saving; offer replacement if needed.

[Official webhook setup](https://api.wasenderapi.com/api-docs/webhooks/webhook-setup).

## Step 5 — Test and finish
Offer an explicit test to a number the customer controls, with the recipient and message visible before sending. Show pending/accepted/delivered accurately. Ready requires an accepted test send and a valid callback for that connection; failures retain the setup step with a useful explanation. A connected provider alone does not prove callbacks work.

## Add another number
Repeat Steps 2–5 using a different WASender session/API key and distinct webhook secret. Show each number's name, verified phone, connection status and callback readiness. Campaigns use their selected number; replies use the originating conversation's number automatically.

## Connection controls
Label the operations “Disconnect from EightBit” and “Remove connection”. These unlink the local integration and preserve history; they do not log out or delete the remote WASender session. Remote session management remains in the customer's WASender dashboard. Restrict these controls to company owner/admin roles. Never allow changing a saved connection to a different phone; add a new connection instead.
