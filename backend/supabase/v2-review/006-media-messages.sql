-- Staging-only media contract. Apply to the isolated test Supabase project first.
BEGIN;
ALTER TABLE outreach_v2.campaigns
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS media_size_bytes integer;
ALTER TABLE outreach_v2.messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS media_size_bytes integer;
ALTER TABLE outreach_v2.messages DROP CONSTRAINT IF EXISTS messages_personalized_message_check;
ALTER TABLE outreach_v2.messages ADD CONSTRAINT messages_personalized_message_check CHECK ((media_type IS NOT NULL) OR length(personalized_message) BETWEEN 1 AND 4096);
ALTER TABLE outreach.conversation_messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS media_size_bytes integer;
ALTER TABLE outreach_v2.campaigns DROP CONSTRAINT IF EXISTS campaigns_media_type_check;
ALTER TABLE outreach_v2.campaigns ADD CONSTRAINT campaigns_media_type_check CHECK (media_type IS NULL OR media_type IN ('image','video','audio','document'));
ALTER TABLE outreach_v2.messages DROP CONSTRAINT IF EXISTS messages_media_type_check;
ALTER TABLE outreach_v2.messages ADD CONSTRAINT messages_media_type_check CHECK (media_type IS NULL OR media_type IN ('image','video','audio','document'));
ALTER TABLE outreach.conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_media_type_check;
ALTER TABLE outreach.conversation_messages ADD CONSTRAINT conversation_messages_media_type_check CHECK (media_type IS NULL OR media_type IN ('image','video','audio','document'));
ALTER TABLE outreach_v2.campaigns DROP CONSTRAINT IF EXISTS campaigns_media_url_check;
ALTER TABLE outreach_v2.campaigns ADD CONSTRAINT campaigns_media_url_check CHECK (media_type IS NULL OR media_url ~* '^https://');
ALTER TABLE outreach_v2.messages DROP CONSTRAINT IF EXISTS messages_media_url_check;
ALTER TABLE outreach_v2.messages ADD CONSTRAINT messages_media_url_check CHECK (media_type IS NULL OR media_url ~* '^https://');
ALTER TABLE outreach.conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_media_url_check;
ALTER TABLE outreach.conversation_messages ADD CONSTRAINT conversation_messages_media_url_check CHECK (media_type IS NULL OR media_url ~* '^https://');
COMMIT;
