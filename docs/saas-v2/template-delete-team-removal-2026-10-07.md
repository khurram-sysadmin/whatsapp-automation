# Template deletion and Team removal - 2026-10-07

Saved templates have Edit template and Delete template controls. Deletion asks for confirmation and archives the row through workspace-scoped deleteTemplate. Archived templates disappear from lists; existing campaign messages and private media objects are retained. Write requests use the existing request-ID protection. Viewer and cross-workspace deletion fail; repeating a delete succeeds safely. Saving the same unique template name restores its availability.

Team removed from navigation, route definitions, page rendering and Settings shortcuts. Workspace membership and permission checks remain in the backend.

Applied migration 014-template-delete.sql to live Supabase project lreolnewuapcurpskqwr through SQL editor query 221f091f-c3b3-4125-8888-108bd011ea62. Readiness returned archive_column=true and delete_action=true. Prior API definition preserved in release_function_backups under 2026-10-07-template-delete. No customer template was deleted during verification. Existing n8n API forwards authenticated payloads to this RPC; no sender/workflow upgrade required.

Validation: production build, media/template security and archival tests, frontend request-ID/auth checks, and lifecycle tests passed. Local synthetic UI preview confirmed the two template actions and no Team navigation. Live verification checked migration readiness only; full customer deletion UI test awaits cPanel upload.

Multiple workspaces: backend bootstrap returns all member workspaces and existing Company selector switches between them. workspaceCreate supports additional workspaces, but customer creation UI is currently initial onboarding only. No create-another-workspace button was added in this change. Subscriptions and operational data are scoped per workspace.

Full package: `WhatsApp-Automation-Template-Delete-Complete-2026-10-07-cPanel.zip`
SHA256: `28037feb85ac06e459b6f05e4e640f7359e3c841251f15b187f32ae7fcc2958d`

Upload into the existing cPanel document root preserving private configuration and data. Database support is already applied. Frontend upload pending.
