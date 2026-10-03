-- REVIEW BEFORE APPLYING. User-approved separate customer queue. No legacy records are moved.
BEGIN;
CREATE SCHEMA IF NOT EXISTS outreach_v2;
REVOKE ALL ON SCHEMA outreach_v2 FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS outreach_v2.campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 whatsapp_session_id uuid NOT NULL REFERENCES outreach.whatsapp_sessions(id),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 template text NOT NULL CHECK(length(template) BETWEEN 1 AND 4096),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','paused','stopped','completed')),
 timezone text NOT NULL DEFAULT 'Asia/Karachi',
 sending_start_time time NOT NULL DEFAULT '09:00',sending_end_time time NOT NULL DEFAULT '17:00',
 send_interval_seconds integer NOT NULL DEFAULT 120 CHECK(send_interval_seconds BETWEEN 15 AND 86400),
 next_send_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,completed_at timestamptz,deleted_at timestamptz,
 UNIQUE(id,workspace_id),UNIQUE(id,workspace_id,whatsapp_session_id)
);
CREATE TABLE IF NOT EXISTS outreach_v2.contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 campaign_id uuid NOT NULL,workspace_contact_id uuid NOT NULL REFERENCES outreach.workspace_contacts(id),
 status text NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','queued','sent','replied','opted_out','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(campaign_id,workspace_id) REFERENCES outreach_v2.campaigns(id,workspace_id),
 UNIQUE(campaign_id,workspace_contact_id),UNIQUE(id,workspace_id)
);
CREATE TABLE IF NOT EXISTS outreach_v2.messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 whatsapp_session_id uuid NOT NULL REFERENCES outreach.whatsapp_sessions(id),
 campaign_id uuid,contact_id uuid,workspace_contact_id uuid NOT NULL REFERENCES outreach.workspace_contacts(id),
 conversation_message_id uuid REFERENCES outreach.conversation_messages(id),
 personalized_message text NOT NULL CHECK(length(personalized_message) BETWEEN 1 AND 4096),
 phone_e164 text NOT NULL CHECK(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','dispatching','sent','delivered','read','failed','canceled','unknown')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 scheduled_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,dispatch_started_at timestamptz,
 provider_message_id text,provider_aliases text[] NOT NULL DEFAULT '{}',provider_response jsonb,error text,
 created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,delivered_at timestamptz,read_at timestamptz,
 FOREIGN KEY(campaign_id,workspace_id,whatsapp_session_id) REFERENCES outreach_v2.campaigns(id,workspace_id,whatsapp_session_id),
 FOREIGN KEY(contact_id,workspace_id) REFERENCES outreach_v2.contacts(id,workspace_id),
 UNIQUE(contact_id),UNIQUE(whatsapp_session_id,provider_message_id)
);
CREATE TABLE IF NOT EXISTS outreach_v2.message_attempts (
 message_id uuid NOT NULL REFERENCES outreach_v2.messages(id),attempt integer NOT NULL,
 outcome text NOT NULL,response jsonb,error text,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(message_id,attempt)
);
CREATE TABLE IF NOT EXISTS outreach_v2.provider_events (
 whatsapp_session_id uuid NOT NULL REFERENCES outreach.whatsapp_sessions(id),event_key text NOT NULL,
 event jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','ignored')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(whatsapp_session_id,event_key)
);
CREATE TABLE IF NOT EXISTS outreach_v2.user_requests (
 user_id uuid NOT NULL REFERENCES auth.users(id),request_key text NOT NULL,request_hash text NOT NULL,response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS v2_campaign_workspace ON outreach_v2.campaigns(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS v2_message_due ON outreach_v2.messages(whatsapp_session_id,scheduled_at) WHERE status='queued';
-- Account-level PATs and session API keys are different credentials. This path requires only a session API key.
ALTER TABLE outreach.provider_accounts DROP CONSTRAINT IF EXISTS provider_accounts_mode_check;
ALTER TABLE outreach.provider_accounts ADD CONSTRAINT provider_accounts_mode_check CHECK(mode IN ('legacy_n8n','manual_pat','manual_session_key','partner'));
ALTER TABLE outreach.whatsapp_sessions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE outreach.whatsapp_sessions ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='outreach_v2' LOOP
  EXECUTE format('ALTER TABLE outreach_v2.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA outreach_v2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA outreach_v2 FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA outreach_v2 REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
