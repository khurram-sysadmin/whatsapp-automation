BEGIN;
-- Archived connections retain their audit history, but must not reserve a
-- customer-visible name forever. Active names remain unique per company.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_sessions_active_display_name_key
 ON outreach.whatsapp_sessions(workspace_id,display_name)
 WHERE deleted_at IS NULL;
ALTER TABLE outreach.whatsapp_sessions
 DROP CONSTRAINT IF EXISTS whatsapp_sessions_workspace_id_display_name_key;
COMMIT;
