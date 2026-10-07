# All supported lead variables - 2026-10-07

Message templates and normal campaign creation now expose all seven fields supported by the existing import and rendering backend: name, first_name, company, phone, email, city, industry. Buttons insert the exact {{field}} tokens at the cursor. Direct test-recipient and inbox composers do not show lead variables. Attachment menu and separate microphone remain unchanged.

Additional arbitrary spreadsheet columns are not currently imported or rendered by the backend. This release does not promise custom-column support or change database/n8n contracts. No backend deployment is required.

Composer tests verified all seven insertions; build and lifecycle checks passed. Browser verified the seven controls in both template and campaign views. No real sends were made.

Team page review: it shows only the signed-in user's name and workspace role; there is no self-service invite, assignment or permission editing interface. It remains unchanged pending a decision to hide it or implement team management.

Full cPanel package: `WhatsApp-Automation-All-Lead-Variables-Complete-2026-10-07-cPanel.zip`
SHA256: `f265801c8f466e1fc8f56e0b47fbfb6f785ef2454e7fa1e1ac6fe004eea8fd5c`
Upload contents into the existing document root while preserving private configuration and data. Production upload pending.
