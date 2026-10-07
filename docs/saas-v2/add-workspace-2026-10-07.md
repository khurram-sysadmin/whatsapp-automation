# Add workspace - 2026-10-07

The sidebar now shows **+ Add workspace** below Company. A focused dialog asks for workspace name and an international IANA timezone, including Asia/Riyadh. Creation refreshes the membership list, selects the new workspace and opens WhatsApp Accounts for its own connection setup.

The frontend uses the existing authenticated `workspaceCreate` action with `companyName` and `timezone`. It does not send a user ID or the previous workspace ID. Existing backend ownership, membership and tenant checks remain in place. Contacts, campaigns and connections continue to be scoped to the selected workspace. No Supabase or n8n changes are required for this release.

A pending-submit guard prevents repeated clicks. If creation succeeds but opening the new workspace fails, the dialog retains its ID and offers Open workspace; retry does not create another record. Existing client request-ID handling is preserved.

Validation: workspace component test, frontend authentication/request-ID checks, lifecycle checks and production build passed. The actual dialog was checked in a local browser fixture with a mocked creation response: the name and Riyadh timezone were submitted and the Company selector changed to the new workspace. No live workspace or customer data was created. Production upload and live verification are pending.

Complete package: `WhatsApp-Automation-Add-Workspace-Complete-2026-10-07-cPanel.zip`

SHA256: `f0b1553da65b52126621983eb413247fd451ecc4f82d30741ca38d0a314d6e34`

Upload the package contents into the existing cPanel document root while preserving private configuration and data, then refresh the browser. The package contains the complete public frontend and existing PHP connection/webhook files; it excludes private config, databases, migrations and source. Git push does not deploy cPanel.
