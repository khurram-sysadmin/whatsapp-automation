BEGIN;

-- =========================================================
-- PLATFORM SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.platform_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO outreach.platform_settings(key, value)
VALUES (
    'provider_mode',
    '"pending_partner"'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- PROVIDER ACCOUNTS
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.provider_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    provider text NOT NULL DEFAULT 'wasender',

    mode text NOT NULL
        CHECK (
            mode IN (
                'legacy_n8n',
                'manual_pat',
                'partner'
            )
        ),

    display_name text NOT NULL,

    credential_secret_id uuid,

    status text NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'invalid',
                'revoked'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (
        workspace_id,
        provider,
        display_name
    )
);

-- =========================================================
-- WHATSAPP SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.whatsapp_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    provider_account_id uuid
        REFERENCES outreach.provider_accounts(id)
        ON DELETE SET NULL,

    provider text NOT NULL DEFAULT 'wasender',

    provider_session_id text,

    display_name text NOT NULL,

    phone_e164 text
        CHECK (
            phone_e164 IS NULL
            OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
        ),

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'connecting',
                'connected',
                'disconnected',
                'expired',
                'error'
            )
        ),

    api_key_secret_id uuid,
    webhook_secret_id uuid,

    is_default boolean NOT NULL DEFAULT false,

    last_seen_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (
        workspace_id,
        display_name
    ),

    UNIQUE (
        provider,
        provider_session_id
    )
);

CREATE INDEX IF NOT EXISTS whatsapp_sessions_workspace_idx
ON outreach.whatsapp_sessions(workspace_id);

CREATE INDEX IF NOT EXISTS whatsapp_sessions_status_idx
ON outreach.whatsapp_sessions(workspace_id, status);

-- =========================================================
-- PER-WHATSAPP-SESSION PACING
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.session_sender_settings (
    whatsapp_session_id uuid PRIMARY KEY
        REFERENCES outreach.whatsapp_sessions(id)
        ON DELETE CASCADE,

    enabled boolean NOT NULL DEFAULT true,

    min_interval_seconds integer NOT NULL DEFAULT 15
        CHECK (
            min_interval_seconds BETWEEN 15 AND 86400
        ),

    next_send_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- MASTER WORKSPACE CONTACTS
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.workspace_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    name text NOT NULL DEFAULT '',
    first_name text NOT NULL DEFAULT '',
    company text NOT NULL DEFAULT '',

    phone_e164 text NOT NULL
        CHECK (
            phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
        ),

    email text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    industry text NOT NULL DEFAULT '',

    status text NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'opted_out'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (
        workspace_id,
        phone_e164
    )
);

CREATE INDEX IF NOT EXISTS workspace_contacts_workspace_idx
ON outreach.workspace_contacts(workspace_id);

-- =========================================================
-- WORKSPACE SUPPRESSION
-- Do NOT change old suppression_list yet because v1 uses it.
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.workspace_suppressions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    phone_e164 text NOT NULL
        CHECK (
            phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
        ),

    reason text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (
        workspace_id,
        phone_e164
    )
);

-- =========================================================
-- WORKSPACE TEMPLATES
-- Keep old templates table untouched for v1.
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.workspace_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    name text NOT NULL,
    body text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (
        workspace_id,
        name
    )
);

-- =========================================================
-- CONVERSATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    whatsapp_session_id uuid NOT NULL
        REFERENCES outreach.whatsapp_sessions(id)
        ON DELETE CASCADE,

    workspace_contact_id uuid NOT NULL
        REFERENCES outreach.workspace_contacts(id)
        ON DELETE CASCADE,

    unread_count integer NOT NULL DEFAULT 0
        CHECK (unread_count >= 0),

    last_message_preview text,
    last_message_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (
        workspace_id,
        whatsapp_session_id,
        workspace_contact_id
    )
);

CREATE INDEX IF NOT EXISTS conversations_workspace_idx
ON outreach.conversations(
    workspace_id,
    last_message_at DESC
);

CREATE TABLE IF NOT EXISTS outreach.conversation_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    conversation_id uuid NOT NULL
        REFERENCES outreach.conversations(id)
        ON DELETE CASCADE,

    whatsapp_session_id uuid NOT NULL
        REFERENCES outreach.whatsapp_sessions(id)
        ON DELETE CASCADE,

    workspace_contact_id uuid NOT NULL
        REFERENCES outreach.workspace_contacts(id)
        ON DELETE CASCADE,

    campaign_id uuid
        REFERENCES outreach.campaigns(id)
        ON DELETE SET NULL,

    direction text NOT NULL
        CHECK (
            direction IN ('inbound','outbound')
        ),

    body text NOT NULL,

    provider_message_id text,

    status text NOT NULL DEFAULT 'received'
        CHECK (
            status IN (
                'queued',
                'sent',
                'delivered',
                'read',
                'failed',
                'received'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx
ON outreach.conversation_messages(
    conversation_id,
    created_at
);

-- =========================================================
-- MONTHLY USAGE
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.usage_monthly (
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    period_start date NOT NULL,

    messages_sent bigint NOT NULL DEFAULT 0,
    campaigns_started bigint NOT NULL DEFAULT 0,
    contacts_imported bigint NOT NULL DEFAULT 0,

    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (
        workspace_id,
        period_start
    )
);

-- =========================================================
-- V2 IDEMPOTENCY
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.api_requests_v2 (
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE,

    request_key text NOT NULL,

    request_body jsonb NOT NULL,
    response jsonb NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (
        workspace_id,
        request_key
    )
);

-- =========================================================
-- PLATFORM ADMINS
-- =========================================================

CREATE TABLE IF NOT EXISTS outreach.platform_admins (
    user_id uuid PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- EXTEND EXISTING V1 TABLES
-- Nullable intentionally while v1 remains operational.
-- =========================================================

ALTER TABLE outreach.campaigns
ADD COLUMN IF NOT EXISTS workspace_id uuid
REFERENCES public.workspaces(id);

ALTER TABLE outreach.campaigns
ADD COLUMN IF NOT EXISTS whatsapp_session_id uuid
REFERENCES outreach.whatsapp_sessions(id);

ALTER TABLE outreach.campaigns
ADD COLUMN IF NOT EXISTS created_by uuid
REFERENCES auth.users(id);

ALTER TABLE outreach.campaigns
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE outreach.contacts
ADD COLUMN IF NOT EXISTS workspace_id uuid
REFERENCES public.workspaces(id);

ALTER TABLE outreach.contacts
ADD COLUMN IF NOT EXISTS workspace_contact_id uuid
REFERENCES outreach.workspace_contacts(id);

ALTER TABLE outreach.messages
ADD COLUMN IF NOT EXISTS workspace_id uuid
REFERENCES public.workspaces(id);

ALTER TABLE outreach.messages
ADD COLUMN IF NOT EXISTS whatsapp_session_id uuid
REFERENCES outreach.whatsapp_sessions(id);

ALTER TABLE outreach.messages
ADD COLUMN IF NOT EXISTS workspace_contact_id uuid
REFERENCES outreach.workspace_contacts(id);

ALTER TABLE outreach.message_attempts
ADD COLUMN IF NOT EXISTS workspace_id uuid
REFERENCES public.workspaces(id);

ALTER TABLE outreach.replies
ADD COLUMN IF NOT EXISTS workspace_id uuid
REFERENCES public.workspaces(id);

ALTER TABLE outreach.replies
ADD COLUMN IF NOT EXISTS whatsapp_session_id uuid
REFERENCES outreach.whatsapp_sessions(id);

ALTER TABLE outreach.replies
ADD COLUMN IF NOT EXISTS workspace_contact_id uuid
REFERENCES outreach.workspace_contacts(id);

ALTER TABLE outreach.replies
ADD COLUMN IF NOT EXISTS conversation_id uuid
REFERENCES outreach.conversations(id);

ALTER TABLE outreach.webhook_events
ADD COLUMN IF NOT EXISTS workspace_id uuid
REFERENCES public.workspaces(id);

ALTER TABLE outreach.webhook_events
ADD COLUMN IF NOT EXISTS whatsapp_session_id uuid
REFERENCES outreach.whatsapp_sessions(id);

CREATE INDEX IF NOT EXISTS campaigns_workspace_idx
ON outreach.campaigns(
    workspace_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS contacts_workspace_idx
ON outreach.contacts(workspace_id);

CREATE INDEX IF NOT EXISTS messages_workspace_idx
ON outreach.messages(
    workspace_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS messages_whatsapp_session_idx
ON outreach.messages(
    whatsapp_session_id,
    scheduled_at
);

-- =========================================================
-- PRIVATE-SCHEMA SECURITY
-- =========================================================

ALTER TABLE outreach.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.session_sender_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.workspace_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.workspace_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.workspace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.api_requests_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.platform_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA outreach
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA outreach
FROM PUBLIC, anon, authenticated;

COMMIT;
