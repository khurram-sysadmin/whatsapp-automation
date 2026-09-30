# WhatsApp Automation maintenance

This repository is EightBit WhatsApp Outreach at https://wamarketing.eightbitsolutions.com. It is unrelated to the ERPNext POS receipt workflow or Carnivore voice agent. The repository's historical name is whatsaoo-automation.

Read README.md and docs/01 - Architecture and Service Map.md first. For a reported bug, read the corresponding frontend, Supabase, n8n and troubleshooting notes before changing code. Check actual live state: documentation and exports are dated snapshots.

Preserve the existing UI, logo artwork, imports, provider events, suppression, queue safeguards and API contract. Use one existing n8n workflow. Supabase connects through HTTPS RPC; never add browser database secrets or PostgreSQL setup to the operator flow. Keep single-admin server authentication and external private storage intact.

Completed is terminal. A completed campaign cannot restart; create a new campaign to send again. Delete archives, retains audit/delivery records and cancels pending work. Unknown outcomes must not be automatically resubmitted.

Never commit credentials, private SQLite/config/session files, customer exports or live execution payloads. Workflow credential reference IDs are not credential values. The n8n export is inactive on import; never create a second active scheduled sender during repair.

Run npm ci, npm run build and npm run test:lifecycle for relevant code/database changes. Check PHP syntax and targeted browser behavior for PHP/UI changes. tests/lifecycle.mjs is local and makes no external calls. Do not trigger outbound sends to diagnose connectivity without an authorized recipient.

Database migrations, publishing n8n and uploading a cPanel build are separate deployments. Git push alone does not deploy them. Keep dated deployment evidence and update docs plus E:/Obsidian Vault/Products/WhatsApp Automation after substantive repairs when that vault is available. Use the existing private directory; deleting auth.sqlite reopens signup and loses the saved connection.
