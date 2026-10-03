Yes. The safest way is to **freeze one contract and build in a strict order**:

**Supabase foundation → n8n v2 backend → frontend v2 → partner integration → production cutover.**

Do **not** modify or replace the working `/v1` workflow while building this. Your current database already has a private `outreach` schema, campaign/contact/message tables, retry logic, suppression, event ingestion and service-only RPC wrappers. We should extend that rather than rebuild it. supabase-setup supabase-setup

One correction to the earlier design: keep the existing campaign status values exactly as they are:

```text
draft
running
paused
stopped
completed
```

For deletion use:

```text
deletedAt
```

instead of adding a `deleted` status. That avoids breaking the existing database constraint.

---

# STEP 0 — Freeze the contract

Give **both frontend and backend developers this exact contract**. Do not allow either side to rename these variables.

### Frontend/API JSON = camelCase

| Purpose | Exact variable |
|---|---|
| Auth user | `userId` |
| Workspace | `workspaceId` |
| Company | `companyName` |
| WhatsApp account | `whatsappSessionId` |
| Provider account | `providerAccountId` |
| Campaign | `campaignId` |
| Contact | `contactId` |
| Conversation | `conversationId` |
| Request ID | `requestId` |
| Phone | `phoneE164` |
| Name | `name` |
| First name | `firstName` |
| Display name | `displayName` |
| Timezone | `timezone` |
| Start time | `sendingStartTime` |
| End time | `sendingEndTime` |
| Interval | `sendIntervalSeconds` |
| Deleted timestamp | `deletedAt` |

### PostgreSQL = snake_case

```text
user_id
workspace_id
company_name
whatsapp_session_id
provider_account_id
campaign_id
workspace_contact_id
conversation_id
request_key
phone_e164
first_name
display_name
sending_start_time
sending_end_time
send_interval_seconds
deleted_at
```

### API URLs

Keep v1 untouched:

```text
https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api
https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/import
```

Build new SaaS API:

```text
https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/api

https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/import

https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/provider-webhook
```

### Standard response

Every v2 endpoint:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "requestId": "req_xxxxxxxx"
}
```

Errors:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Human readable message"
  },
  "requestId": "req_xxxxxxxx"
}
```

---

# STEP 1 — Supabase Auth configuration

Before SQL, go to:

```text
Supabase
→ Authentication
→ Providers
→ Email
```

Enable:

```text
Email/password signup
Email verification
Password reset
```

Set Site URL:

```text
https://wamarketing.eightbitsolutions.com
```

Use Supabase's new **publishable key** in the browser and **secret key** on n8n/server-side. Supabase currently recommends `sb_publishable_...` for shipped clients and `sb_secret_...` for backends; secret keys bypass RLS and must never reach the browser. [Supabase](https://supabase.com/docs/guides/getting-started/api-keys?utm_source=chatgpt.com)

Your frontend will eventually have only:

```env
VITE_SUPABASE_URL=https://lreolnewuapcurpskqwr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
VITE_OUTREACH_API_URL=https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/api
VITE_OUTREACH_IMPORT_URL=https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/import
VITE_APP_URL=https://wamarketing.eightbitsolutions.com
VITE_DEFAULT_TIMEZONE=Asia/Karachi
```

Never put these in Vite:

```text
sb_secret_...
service_role
WASender API key
partner token
webhook secret
X-Outreach-Key
```

---

# STEP 2 — Supabase SQL: SaaS identity foundation

Run this **first** in Supabase SQL Editor.

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- =========================================================
-- USER PROFILES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL DEFAULT '',
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- WORKSPACES / COMPANIES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name text NOT NULL CHECK (length(company_name) BETWEEN 1 AND 200),
    slug text NOT NULL UNIQUE,
    timezone text NOT NULL DEFAULT 'Asia/Karachi',
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','suspended')),
    onboarding_step text NOT NULL DEFAULT 'company'
        CHECK (onboarding_step IN ('company','whatsapp','test','complete')),
    onboarding_completed_at timestamptz,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner','admin','agent','viewer')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx
ON public.workspace_members(workspace_id);

-- =========================================================
-- PLANS / SUBSCRIPTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.plans (
    code text PRIMARY KEY,
    name text NOT NULL,
    max_whatsapp_sessions integer,
    max_team_members integer,
    max_contacts integer,
    max_monthly_messages integer,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Development/beta plan. NULL = unlimited during development.
INSERT INTO public.plans (
    code,
    name,
    max_whatsapp_sessions,
    max_team_members,
    max_contacts,
    max_monthly_messages
)
VALUES (
    'beta',
    'Beta',
    NULL,
    NULL,
    NULL,
    NULL
)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.subscriptions (
    workspace_id uuid PRIMARY KEY
        REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_code text NOT NULL DEFAULT 'beta'
        REFERENCES public.plans(code),
    status text NOT NULL DEFAULT 'trialing'
        CHECK (
            status IN (
                'trialing',
                'active',
                'past_due',
                'canceled',
                'suspended'
            )
        ),
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz,
    external_customer_id text,
    external_subscription_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- PROFILE AUTO-CREATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        user_id,
        full_name
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- RLS HELPERS
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(
    p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(
    p_workspace_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT wm.role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.workspace_role(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.workspace_role(uuid)
TO authenticated;

-- =========================================================
-- RLS
-- =========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS workspaces_member_select ON public.workspaces;
CREATE POLICY workspaces_member_select
ON public.workspaces
FOR SELECT
TO authenticated
USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS workspace_members_member_select
ON public.workspace_members;

CREATE POLICY workspace_members_member_select
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS plans_read ON public.plans;
CREATE POLICY plans_read
ON public.plans
FOR SELECT
TO authenticated
USING (active = true);

DROP POLICY IF EXISTS subscriptions_member_select
ON public.subscriptions;

CREATE POLICY subscriptions_member_select
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Read-only browser access.
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

COMMIT;
```

This deliberately keeps creation/administration of workspaces on your backend rather than giving browser clients unrestricted inserts.

Supabase Auth JWTs work with RLS through `auth.uid()`. [Supabase](https://supabase.com/docs/guides/auth/jwts?utm_source=chatgpt.com)

---

# STEP 3 — Verify SQL 1

Run:

```sql
select
    table_schema,
    table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
    'profiles',
    'workspaces',
    'workspace_members',
    'plans',
    'subscriptions'
)
order by table_name;
```

You should see all five.

Also:

```sql
select * from public.plans;
```

Expected:

```text
beta
Beta
```

Do not continue if SQL 1 produced errors.

---

# STEP 4 — Supabase SQL: private SaaS tables

Now run this.

```sql
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
```

This preserves your existing private schema approach. Your current v1 setup already deliberately revokes browser access to the `outreach` schema and exposes only service-side RPCs. supabase-setup

---

# STEP 5 — Verify SQL 2

Run:

```sql
select
    table_name
from information_schema.tables
where table_schema = 'outreach'
and table_name in (
    'provider_accounts',
    'whatsapp_sessions',
    'session_sender_settings',
    'workspace_contacts',
    'workspace_suppressions',
    'workspace_templates',
    'conversations',
    'conversation_messages',
    'usage_monthly',
    'api_requests_v2',
    'platform_admins'
)
order by table_name;
```

Then:

```sql
select
    column_name
from information_schema.columns
where table_schema = 'outreach'
and table_name = 'campaigns'
and column_name in (
    'workspace_id',
    'whatsapp_session_id',
    'created_by',
    'deleted_at'
)
order by column_name;
```

All four must appear.

---

# STEP 6 — Create your own SaaS user

Now use the new frontend signup or Supabase Authentication → Users to create **your EightBit owner account**.

Then find the UUID:

```sql
select
    id,
    email,
    created_at
from auth.users
order by created_at desc;
```

Copy your UUID.

---

# STEP 7 — Migrate your existing working system into an EightBit workspace

Replace:

```text
PUT-YOUR-USER-UUID-HERE
```

with your actual Supabase Auth UUID.

Run:

```sql
DO $$
DECLARE
    v_user uuid := 'PUT-YOUR-USER-UUID-HERE'::uuid;

    v_workspace uuid;
    v_provider_account uuid;
    v_session uuid;
BEGIN

    -- -----------------------------------------------------
    -- EightBit workspace
    -- -----------------------------------------------------

    INSERT INTO public.workspaces (
        company_name,
        slug,
        timezone,
        status,
        onboarding_step,
        onboarding_completed_at,
        created_by
    )
    VALUES (
        'EightBit Solutions',
        'eightbit-solutions',
        'Asia/Karachi',
        'active',
        'complete',
        now(),
        v_user
    )
    ON CONFLICT (slug)
    DO UPDATE SET
        company_name = EXCLUDED.company_name,
        timezone = EXCLUDED.timezone
    RETURNING id INTO v_workspace;

    -- -----------------------------------------------------
    -- Owner
    -- -----------------------------------------------------

    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role
    )
    VALUES (
        v_workspace,
        v_user,
        'owner'
    )
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET role = 'owner';

    -- -----------------------------------------------------
    -- Beta subscription
    -- -----------------------------------------------------

    INSERT INTO public.subscriptions (
        workspace_id,
        plan_code,
        status
    )
    VALUES (
        v_workspace,
        'beta',
        'active'
    )
    ON CONFLICT (workspace_id)
    DO NOTHING;

    -- -----------------------------------------------------
    -- Existing n8n WASender connection
    -- -----------------------------------------------------

    INSERT INTO outreach.provider_accounts (
        workspace_id,
        provider,
        mode,
        display_name,
        status
    )
    VALUES (
        v_workspace,
        'wasender',
        'legacy_n8n',
        'Existing WASender Connection',
        'active'
    )
    ON CONFLICT (
        workspace_id,
        provider,
        display_name
    )
    DO UPDATE SET
        status = 'active'
    RETURNING id INTO v_provider_account;

    INSERT INTO outreach.whatsapp_sessions (
        workspace_id,
        provider_account_id,
        provider,
        display_name,
        status,
        is_default
    )
    VALUES (
        v_workspace,
        v_provider_account,
        'wasender',
        'Primary WhatsApp',
        'connected',
        true
    )
    ON CONFLICT (
        workspace_id,
        display_name
    )
    DO UPDATE SET
        status = 'connected',
        is_default = true
    RETURNING id INTO v_session;

    INSERT INTO outreach.session_sender_settings (
        whatsapp_session_id,
        enabled,
        min_interval_seconds
    )
    VALUES (
        v_session,
        true,
        15
    )
    ON CONFLICT (whatsapp_session_id)
    DO NOTHING;

    -- -----------------------------------------------------
    -- Backfill campaigns
    -- -----------------------------------------------------

    UPDATE outreach.campaigns
    SET
        workspace_id = v_workspace,
        whatsapp_session_id = v_session,
        created_by = v_user
    WHERE workspace_id IS NULL;

    -- -----------------------------------------------------
    -- Backfill campaign contacts
    -- -----------------------------------------------------

    UPDATE outreach.contacts c
    SET workspace_id = ca.workspace_id
    FROM outreach.campaigns ca
    WHERE c.campaign_id = ca.id
      AND c.workspace_id IS NULL;

    -- -----------------------------------------------------
    -- Build master workspace contacts
    -- -----------------------------------------------------

    INSERT INTO outreach.workspace_contacts (
        workspace_id,
        name,
        first_name,
        company,
        phone_e164,
        email,
        city,
        industry
    )
    SELECT DISTINCT ON (
        c.workspace_id,
        c.phone
    )
        c.workspace_id,
        c.name,
        c.first_name,
        c.company,
        c.phone,
        c.email,
        c.city,
        c.industry
    FROM outreach.contacts c
    WHERE c.workspace_id = v_workspace
    ORDER BY
        c.workspace_id,
        c.phone,
        c.created_at DESC
    ON CONFLICT (
        workspace_id,
        phone_e164
    )
    DO UPDATE SET
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        company = EXCLUDED.company,
        email = EXCLUDED.email,
        city = EXCLUDED.city,
        industry = EXCLUDED.industry,
        updated_at = now();

    UPDATE outreach.contacts c
    SET workspace_contact_id = wc.id
    FROM outreach.workspace_contacts wc
    WHERE wc.workspace_id = c.workspace_id
      AND wc.phone_e164 = c.phone
      AND c.workspace_contact_id IS NULL;

    -- -----------------------------------------------------
    -- Messages
    -- -----------------------------------------------------

    UPDATE outreach.messages m
    SET
        workspace_id = ca.workspace_id,
        whatsapp_session_id = ca.whatsapp_session_id,
        workspace_contact_id = ct.workspace_contact_id
    FROM outreach.campaigns ca,
         outreach.contacts ct
    WHERE m.campaign_id = ca.id
      AND m.contact_id = ct.id
      AND m.workspace_id IS NULL;

    UPDATE outreach.message_attempts ma
    SET workspace_id = m.workspace_id
    FROM outreach.messages m
    WHERE ma.message_id = m.id
      AND ma.workspace_id IS NULL;

    -- -----------------------------------------------------
    -- Replies
    -- -----------------------------------------------------

    UPDATE outreach.replies r
    SET
        workspace_id = ca.workspace_id,
        whatsapp_session_id = ca.whatsapp_session_id,
        workspace_contact_id = ct.workspace_contact_id
    FROM outreach.campaigns ca,
         outreach.contacts ct
    WHERE r.campaign_id = ca.id
      AND r.contact_id = ct.id
      AND r.workspace_id IS NULL;

    -- -----------------------------------------------------
    -- Existing suppressions become EightBit suppressions
    -- -----------------------------------------------------

    INSERT INTO outreach.workspace_suppressions (
        workspace_id,
        phone_e164,
        reason,
        created_at
    )
    SELECT
        v_workspace,
        s.phone,
        s.reason,
        s.created_at
    FROM outreach.suppression_list s
    ON CONFLICT (
        workspace_id,
        phone_e164
    )
    DO NOTHING;

    -- -----------------------------------------------------
    -- Existing templates
    -- -----------------------------------------------------

    INSERT INTO outreach.workspace_templates (
        workspace_id,
        name,
        body,
        created_at
    )
    SELECT
        v_workspace,
        t.name,
        t.body,
        t.created_at
    FROM outreach.templates t
    ON CONFLICT (
        workspace_id,
        name
    )
    DO UPDATE SET
        body = EXCLUDED.body,
        updated_at = now();

END $$;
```

---

# STEP 8 — Verify legacy migration

Run:

```sql
select
    w.id as workspace_id,
    w.company_name,
    wm.role,
    s.plan_code,
    s.status as subscription_status
from public.workspaces w
join public.workspace_members wm
    on wm.workspace_id = w.id
left join public.subscriptions s
    on s.workspace_id = w.id;
```

Then:

```sql
select
    id,
    display_name,
    status,
    is_default
from outreach.whatsapp_sessions;
```

Then:

```sql
select
    count(*) as campaigns_without_workspace
from outreach.campaigns
where workspace_id is null;
```

For your current existing campaigns, expected:

```text
0
```

Then:

```sql
select
    count(*) as contacts_without_workspace
from outreach.contacts
where workspace_id is null;
```

And:

```sql
select
    count(*) as messages_without_workspace
from outreach.messages
where workspace_id is null;
```

Expected for existing data:

```text
0
```

---

# STEP 9 — Backend prompt for Codex

Now give Codex this exact prompt.

> **EightBit Outreach SaaS v2 — n8n Backend**
>
> I already have a working production n8n workflow named `EightBit WhatsApp Outreach`.
>
> DO NOT modify, remove or break the existing v1 routes or existing working campaign worker.
>
> Existing v1 must remain operational while v2 is developed.
>
> Keep everything in ONE n8n workflow.
>
> Add three new branches:
>
> ```text
> POST /eightbit-outreach/v2/api
> POST /eightbit-outreach/v2/import
> POST /eightbit-outreach/v2/provider-webhook
> ```
>
> Production hostname:
>
> ```text
> https://n8n.eightbitsolutions.com
> ```
>
> Frontend:
>
> ```text
> https://wamarketing.eightbitsolutions.com
> ```
>
> ### CRITICAL CONTRACT
>
> Browser/API JSON uses camelCase only.
>
> Use EXACTLY:
>
> ```text
> userId
> workspaceId
> companyName
> whatsappSessionId
> providerAccountId
> campaignId
> contactId
> conversationId
> requestId
> phoneE164
> displayName
> timezone
> sendingStartTime
> sendingEndTime
> sendIntervalSeconds
> deletedAt
> ```
>
> PostgreSQL uses snake_case internally.
>
> Do not return raw snake_case database objects to the frontend. Map responses to camelCase.
>
> ### AUTHENTICATION
>
> v2 does NOT use `X-Outreach-Key`.
>
> Every frontend request carries:
>
> ```http
> Authorization: Bearer <SUPABASE_USER_ACCESS_TOKEN>
> ```
>
> The Webhook node itself may use no static Header Auth because authentication is dynamic.
>
> Immediately after the webhook:
>
> 1. Require `Authorization`.
> 2. Require `Bearer`.
> 3. Extract JWT.
> 4. Validate JWT using:
>
> ```text
> GET https://lreolnewuapcurpskqwr.supabase.co/auth/v1/user
> ```
>
> headers:
>
> ```text
> apikey: SUPABASE_PUBLISHABLE_KEY
> Authorization: Bearer <USER_JWT>
> ```
>
> 5. HTTP 200 means valid user.
> 6. Derive `userId` exclusively from returned Supabase user `id`.
> 7. NEVER trust a browser supplied `userId`.
> 8. Return 401 before any database operation if validation fails.
>
> Supabase documents `/auth/v1/user` with a publishable `apikey` plus the user's Bearer JWT as a valid server-side verification method.
>
> ### SUPABASE BACKEND CREDENTIAL
>
> Create a new n8n backend credential:
>
> ```text
> Supabase SaaS Backend
> ```
>
> Use:
>
> ```text
> Host:
> https://lreolnewuapcurpskqwr.supabase.co
>
> Secret:
> sb_secret_...
> ```
>
> Do not change the v1 `Supabase account 2` credential.
>
> Do not expose the secret to frontend.
>
> ### STANDARD RESPONSE
>
> Every v2 response MUST be:
>
> ```json
> {
>   "success": true,
>   "data": {},
>   "error": null,
>   "requestId": "..."
> }
> ```
>
> Failure:
>
> ```json
> {
>   "success": false,
>   "data": null,
>   "error": {
>     "code": "ERROR_CODE",
>     "message": "Readable message"
>   },
>   "requestId": "..."
> }
> ```
>
> ### WORKSPACE AUTHORIZATION
>
> After JWT validation, every request containing `workspaceId` must verify:
>
> ```text
> workspace_members.workspace_id = workspaceId
> workspace_members.user_id = authenticated userId
> ```
>
> Also load role:
>
> ```text
> owner
> admin
> agent
> viewer
> ```
>
> Never authorize a request simply because the browser supplied a valid UUID.
>
> ### ACTIONS
>
> Support EXACTLY:
>
> ```text
> bootstrap
> workspaceCreate
> workspaceUpdate
> profileUpdate
>
> sessionList
> sessionCreate
> sessionConnect
> sessionStatus
> sessionDisconnect
> sessionDelete
>
> create
> list
> detail
> start
> pause
> resume
> stop
> delete
> stats
> messages
> contacts
>
> templates
> saveTemplate
> suppress
>
> inbox
> conversation
> reply
> markConversationRead
>
> subscription
> usage
> health
> ```
>
> Every write action requires:
>
> ```text
> requestId
> ```
>
> Require 8–128 characters.
>
> Use `outreach.api_requests_v2` for idempotency.
>
> ### BOOTSTRAP
>
> Request:
>
> ```json
> {
>   "action": "bootstrap"
> }
> ```
>
> Return:
>
> ```json
> {
>   "user": {
>     "userId": "...",
>     "email": "...",
>     "fullName": "..."
>   },
>   "workspaces": [],
>   "currentWorkspaceId": null,
>   "providerMode": "pending_partner"
> }
> ```
>
> Workspace object:
>
> ```json
> {
>   "workspaceId": "UUID",
>   "companyName": "EightBit Solutions",
>   "timezone": "Asia/Karachi",
>   "status": "active",
>   "role": "owner",
>   "onboardingStep": "complete"
> }
> ```
>
> ### WORKSPACE CREATE
>
> Request:
>
> ```json
> {
>   "action": "workspaceCreate",
>   "requestId": "req_xxxxxxxx",
>   "companyName": "ABC Company",
>   "timezone": "Asia/Karachi"
> }
> ```
>
> Backend must:
>
> 1. derive userId from JWT
> 2. validate timezone
> 3. create workspace
> 4. create workspace_members role owner
> 5. create beta subscription
> 6. return `workspaceId`
>
> ### WHATSAPP SESSIONS
>
> Canonical session response:
>
> ```json
> {
>   "whatsappSessionId": "UUID",
>   "displayName": "Karachi Sales",
>   "phoneE164": "+923331234567",
>   "status": "connected",
>   "isDefault": true
> }
> ```
>
> A workspace may have multiple sessions.
>
> While WASender partner approval is pending:
>
> - preserve the existing legacy EightBit WhatsApp session
> - build all session database/UI logic
> - keep partner provisioning behind a provider adapter
> - DO NOT fake successful QR provisioning
> - return a clear `PROVIDER_NOT_CONFIGURED` response if partner credentials are required but unavailable
>
> Provider interface:
>
> ```text
> createSession()
> connectSession()
> getSessionStatus()
> disconnectSession()
> deleteSession()
> sendMessage()
> ```
>
> When partner credentials arrive, implement these methods without changing frontend contracts.
>
> ### CAMPAIGN CREATE
>
> Request EXACTLY:
>
> ```json
> {
>   "action": "create",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "whatsappSessionId": "UUID",
>   "name": "Restaurant Outreach",
>   "template": "Hi {{first_name}}, ...",
>   "timezone": "Asia/Karachi",
>   "sendingStartTime": "09:00",
>   "sendingEndTime": "17:00",
>   "sendIntervalSeconds": 120
> }
> ```
>
> Validate:
>
> - workspace membership
> - workspace active
> - selected session belongs to workspace
> - session connected
> - campaign fields
> - timezone
> - interval
>
> Save:
>
> ```text
> workspace_id
> whatsapp_session_id
> created_by
> ```
>
> ### CAMPAIGN STATUS
>
> Do not change the existing status values:
>
> ```text
> draft
> running
> paused
> stopped
> completed
> ```
>
> Delete is represented by:
>
> ```text
> deleted_at
> ```
>
> not a `deleted` status.
>
> `list`, `stats`, etc. must exclude `deleted_at IS NOT NULL`.
>
> ### IMPORT
>
> Endpoint:
>
> ```text
> POST /eightbit-outreach/v2/import
> ```
>
> Query:
>
> ```text
> workspaceId
> campaignId
> requestId
> ```
>
> Multipart field:
>
> ```text
> file
> ```
>
> Accept CSV/XLSX using the existing validation logic.
>
> Existing supported spreadsheet fields:
>
> ```text
> name
> first_name
> company
> phone
> email
> city
> industry
> ```
>
> The frontend may display `firstName`, but spreadsheet compatibility remains `first_name`.
>
> During import:
>
> 1. verify workspace membership
> 2. verify campaign belongs to workspace
> 3. require draft status
> 4. normalize phone
> 5. upsert `outreach.workspace_contacts`
> 6. create campaign-scoped `outreach.contacts`
> 7. set `workspace_id`
> 8. set `workspace_contact_id`
> 9. respect `workspace_suppressions`
>
> ### WORKER
>
> Do NOT use one customer's provider credentials for another.
>
> Each claimed message must carry:
>
> ```text
> messageId
> workspaceId
> campaignId
> whatsappSessionId
> contactId
> phoneE164
> personalizedMessage
> ```
>
> The v2 worker must enforce:
>
> - workspace active
> - subscription allowed
> - campaign running
> - session connected
> - session sender enabled
> - session next_send_at due
> - campaign next_send_at due
> - campaign sending window
> - message scheduled_at due
> - recipient not suppressed in that workspace
>
> Keep existing retry/lease/unknown-outcome safety behavior.
>
> Current v1 uses a single global sender and prevents another send while any message is leased/dispatching. Do not use that global serialization model for different SaaS customer sessions.
>
> For v2, concurrency boundary must be:
>
> ```text
> one active dispatch per whatsappSessionId
> ```
>
> Different WhatsApp sessions may independently dispatch.
>
> ### INBOX
>
> `inbox` response:
>
> ```json
> {
>   "conversationId": "UUID",
>   "whatsappSessionId": "UUID",
>   "contact": {
>     "contactId": "UUID",
>     "name": "Ali Khan",
>     "firstName": "Ali",
>     "company": "ABC Restaurant",
>     "phoneE164": "+923331234567"
>   },
>   "lastMessage": "Can you send pricing?",
>   "lastMessageAt": "...",
>   "unreadCount": 1
> }
> ```
>
> ### REPLY
>
> Request:
>
> ```json
> {
>   "action": "reply",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "conversationId": "UUID",
>   "text": "Sure, here are the details."
> }
> ```
>
> NEVER accept phone or whatsappSessionId from the reply form as authoritative.
>
> Backend must derive:
>
> ```text
> workspaceContact
> phoneE164
> whatsappSessionId
> ```
>
> from the conversation.
>
> Send through that session.
>
> Persist outbound conversation message.
>
> ### INBOUND WEBHOOKS
>
> Provider webhook must resolve provider session → `whatsappSessionId` → `workspaceId`.
>
> Create/update:
>
> ```text
> workspace_contacts
> conversations
> conversation_messages
> ```
>
> Update delivery/read status.
>
> Maintain opt-out handling per workspace using:
>
> ```text
> outreach.workspace_suppressions
> ```
>
> Do not use the old global suppression table for v2.
>
> ### CONTACT DISPLAY
>
> Backend should return:
>
> ```text
> name
> firstName
> company
> phoneE164
> ```
>
> not only phone.
>
> ### DELETE CAMPAIGN
>
> `delete` is soft delete.
>
> For running campaigns require stop first.
>
> Set:
>
> ```text
> deleted_at = now()
> ```
>
> Keep historical messages and delivery data.
>
> ### SECURITY
>
> Never log:
>
> - user JWT
> - Supabase secret key
> - partner token
> - WASender API key
> - provider webhook secret
>
> Do not return provider credentials to browser.
>
> ### OUTPUT
>
> Produce:
>
> 1. updated n8n workflow JSON
> 2. exact node-by-node change report
> 3. `supabase-v2-runtime.sql` containing ONLY new v2 database functions/RPC wrappers
> 4. API contract document
> 5. test payloads for every action
> 6. migration/rollback notes
>
> Do NOT replace existing v1 functions such as:
>
> ```text
> outreach.api
> outreach.claim_next
> outreach.begin_send
> outreach.finish_send
> outreach.ingest_events
> outreach.process_events
> outreach.maintenance
> ```
>
> Create separate `_v2` functions.
>
> Do not touch the working v1 public RPC wrappers.
>
> Before declaring complete, test v1 and v2 independently.

Your current workflow's scheduled branch is one 15-second scheduler with Supabase handling timing/retries. Pasted text The v2 implementation should preserve that safety philosophy but make pacing/session locks tenant-aware.

---

# STEP 10 — Important: review Codex's runtime SQL before running it

Codex should return:

```text
supabase-v2-runtime.sql
```

**Do not immediately execute it.**

Send that SQL to me first.

That file will contain the higher-risk logic:

```text
api_v2
claim_next_v2 / claim_batch_v2
begin_send_v2
finish_send_v2
ingest_events_v2
process_events_v2
maintenance_v2
```

Those functions affect actual dispatch behavior, so this is the one part I recommend reviewing before it touches production.

Your existing v1 equivalents already implement careful leasing, retries and `unknown` outcomes; we should preserve those guarantees. supabase-setup

---

# STEP 11 — Frontend master prompt

Only after the Supabase foundation exists and Codex has implemented the v2 backend, give your frontend developer this:

> **EightBit Outreach — SaaS v2 Production Frontend**
>
> Convert the existing working frontend into the final multi-tenant SaaS frontend.
>
> DO NOT use the old v1 API.
>
> Production:
>
> ```text
> https://wamarketing.eightbitsolutions.com
> ```
>
> API:
>
> ```text
> https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/api
> ```
>
> Import:
>
> ```text
> https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/import
> ```
>
> ### Environment variables
>
> Use EXACTLY:
>
> ```env
> VITE_SUPABASE_URL=
> VITE_SUPABASE_PUBLISHABLE_KEY=
> VITE_OUTREACH_API_URL=
> VITE_OUTREACH_IMPORT_URL=
> VITE_APP_URL=https://wamarketing.eightbitsolutions.com
> VITE_DEFAULT_TIMEZONE=Asia/Karachi
> ```
>
> Never create:
>
> ```text
> VITE_SUPABASE_SECRET_KEY
> VITE_WASENDER_KEY
> VITE_OUTREACH_KEY
> ```
>
> ### API authentication
>
> Use Supabase Auth.
>
> Before every n8n v2 request:
>
> ```ts
> const {
>   data: { session }
> } = await supabase.auth.getSession();
> ```
>
> Send:
>
> ```http
> Authorization: Bearer <session.access_token>
> Content-Type: application/json
> ```
>
> Never send browser `userId` as authorization proof.
>
> ### Exact field contract
>
> Use these variables and no alternatives:
>
> ```text
> userId
> workspaceId
> companyName
> whatsappSessionId
> providerAccountId
> campaignId
> contactId
> conversationId
> requestId
> phoneE164
> name
> firstName
> displayName
> timezone
> sendingStartTime
> sendingEndTime
> sendIntervalSeconds
> deletedAt
> ```
>
> ### Authentication pages
>
> Build:
>
> ```text
> /signup
> /login
> /forgot-password
> /reset-password
> ```
>
> Use Supabase Auth.
>
> Signup fields:
>
> ```text
> fullName
> email
> password
> confirmPassword
> ```
>
> After signup/email verification call:
>
> ```json
> {
>   "action": "bootstrap"
> }
> ```
>
> If user has no workspace, launch onboarding.
>
> ### Onboarding
>
> Professional four-step wizard:
>
> ```text
> Company
> → WhatsApp
> → Test
> → Ready
> ```
>
> Company request:
>
> ```json
> {
>   "action": "workspaceCreate",
>   "requestId": "req_xxxxxxxx",
>   "companyName": "ABC Company",
>   "timezone": "Asia/Karachi"
> }
> ```
>
> Persist returned:
>
> ```text
> workspaceId
> ```
>
> Do not generate a local workspace ID.
>
> ### WhatsApp step
>
> Page:
>
> ```text
> Connect your WhatsApp
> ```
>
> Display existing sessions.
>
> Session card fields:
>
> ```text
> displayName
> phoneE164
> status
> isDefault
> ```
>
> Button:
>
> ```text
> + Add WhatsApp Account
> ```
>
> Until backend returns a real QR, do not generate fake QR data.
>
> If backend returns:
>
> ```text
> PROVIDER_NOT_CONFIGURED
> ```
>
> show a professional setup-pending message.
>
> When partner API becomes active, display returned QR directly in this page without changing frontend contracts.
>
> ### Application navigation
>
> Build:
>
> ```text
> Dashboard
> Campaigns
> Contacts
> Inbox
> WhatsApp Accounts
> Templates
> Analytics
> Team
> Billing
> Settings
> ```
>
> ### Header
>
> Display:
>
> ```text
> companyName
> fullName
> current WhatsApp connection status
> ```
>
> Workspace name must come from backend.
>
> ### Dashboard
>
> KPI cards:
>
> ```text
> WhatsApp Accounts
> Active Campaigns
> Total Contacts
> Queued
> Sent
> Delivered
> Read
> Replied
> Failed
> Opted Out
> ```
>
> Sections:
>
> ```text
> Recent Campaigns
> Recent Conversations
> Message Performance
> WhatsApp Account Status
> Monthly Usage
> ```
>
> Missing numeric data renders `0`.
>
> Never render:
>
> ```text
> undefined
> NaN
> null
> ```
>
> ### Campaign creation
>
> Fields:
>
> ```text
> name
> whatsappSessionId
> template
> timezone
> sendingStartTime
> sendingEndTime
> sendIntervalSeconds
> ```
>
> `whatsappSessionId` is mandatory.
>
> Only show sessions where:
>
> ```text
> status === "connected"
> ```
>
> Exact request:
>
> ```json
> {
>   "action": "create",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "whatsappSessionId": "UUID",
>   "name": "Restaurant Outreach",
>   "template": "Hi {{first_name}}, ...",
>   "timezone": "Asia/Karachi",
>   "sendingStartTime": "09:00",
>   "sendingEndTime": "17:00",
>   "sendIntervalSeconds": 120
> }
> ```
>
> Store returned `campaignId`.
>
> Never generate fake/local campaign IDs.
>
> ### Campaign statuses
>
> Frontend supports ONLY:
>
> ```text
> draft
> running
> paused
> stopped
> completed
> ```
>
> Deletion uses:
>
> ```text
> deletedAt
> ```
>
> ### Campaign actions
>
> ```text
> draft:
> Start / Delete
>
> running:
> Pause / Stop
>
> paused:
> Resume / Stop / Delete
>
> stopped:
> Delete
>
> completed:
> Delete
> ```
>
> Delete requires confirmation.
>
> ### Import
>
> URL:
>
> ```text
> VITE_OUTREACH_IMPORT_URL
> ```
>
> Query:
>
> ```text
> workspaceId
> campaignId
> requestId
> ```
>
> multipart:
>
> ```text
> file
> ```
>
> Do NOT manually set multipart `Content-Type`.
>
> Excel/CSV fields remain:
>
> ```text
> name
> first_name
> company
> phone
> email
> city
> industry
> ```
>
> ### Contacts page
>
> Display:
>
> ```text
> name
> firstName
> company
> phoneE164
> email
> city
> industry
> status
> ```
>
> Search by:
>
> ```text
> name
> company
> phoneE164
> email
> ```
>
> ### Inbox
>
> Replace the old replies screen.
>
> Conversation list:
>
> ```text
> Ali Khan
> ABC Restaurant
> +92 333 1234567
> Can you send me pricing?
> 2m ago
> ```
>
> Do NOT display only a number when contact information exists.
>
> Conversation panel shows inbound/outbound bubbles.
>
> Reply request:
>
> ```json
> {
>   "action": "reply",
>   "requestId": "req_xxxxxxxx",
>   "workspaceId": "UUID",
>   "conversationId": "UUID",
>   "text": "Sure, I can share pricing."
> }
> ```
>
> Do not send phone/session from frontend for replies.
>
> ### Multiple WhatsApp accounts
>
> Page:
>
> ```text
> WhatsApp Accounts
> ```
>
> Example:
>
> ```text
> Karachi Sales
> +92 333 xxx xxxx
> Connected
>
> Lahore Sales
> +92 300 xxx xxxx
> Connected
>
> [+ Add WhatsApp Account]
> ```
>
> Campaign creation must allow choosing one.
>
> ### Billing
>
> Read backend subscription:
>
> ```text
> planCode
> status
> whatsappSessionLimit
> teamMemberLimit
> contactLimit
> monthlyMessageLimit
> ```
>
> Do not hardcode plan enforcement in frontend.
>
> Backend remains authoritative.
>
> ### Settings
>
> Build:
>
> ```text
> Profile
> Company
> Security
> WhatsApp Accounts
> Team
> Billing
> ```
>
> Change password directly through Supabase Auth.
>
> ### Error handling
>
> Application must never display a blank page.
>
> Keep AppShell mounted.
>
> Use:
>
> ```text
> loading state
> inline API error
> toast
> ErrorBoundary
> ```
>
> Normalize every backend response.
>
> No unsafe:
>
> ```ts
> value.toLowerCase()
> ```
>
> Use:
>
> ```ts
> String(value ?? '').toLowerCase()
> ```
>
> where appropriate.
>
> ### Polling
>
> No duplicate polling timers.
>
> Dashboard:
>
> ```text
> 30–60 second refresh
> ```
>
> Running campaign:
>
> ```text
> approximately 10–15 second refresh
> ```
>
> Completed/stopped campaign:
>
> no aggressive polling.
>
> Cleanup all timers on unmount.
>
> ### Source of truth
>
> Backend is authoritative.
>
> Do not store fake campaigns, fake message counts or fake statuses in localStorage.
>
> localStorage may contain only non-sensitive UI preferences.
>
> ### Final build
>
> Generate:
>
> ```text
> WhatsApp-Automation-SaaS-cPanel-ready.zip
> ```
>
> with production build:
>
> ```text
> index.html
> assets/
> .htaccess
> favicon.svg
> icons.svg
> logo.jpg
> ```
>
> No API secrets.
>
> Test:
>
> ```text
> Signup
> Login
> Verify email
> Create company
> Dashboard isolation
> Multiple workspaces where supported
> WhatsApp Accounts
> Create campaign
> Upload
> Start
> Pause
> Resume
> Stop
> Delete
> Message history
> Contact name/company
> Inbox
> Reply
> Password change
> Logout
> Login
> Page refresh
> Mobile
> API unavailable
> ```
>
> Do not mark any test passed unless actually tested.

---

# STEP 12 — Final authentication alignment

Your flow should now be exactly:

```text
Browser
   ↓
Supabase Auth
   ↓
User JWT
   ↓
n8n v2
   ↓
Validate JWT with Supabase
   ↓
derive userId
   ↓
verify workspace membership
   ↓
private Supabase outreach data
```

Supabase's current documented server-side validation method supports:

```http
GET /auth/v1/user
apikey: sb_publishable_...
Authorization: Bearer <USER JWT>
``` :chatgpt-content-reference{index="7"}


---

# STEP 13 — WASender partner integration later

Do **not** block the SaaS build while waiting.

For now:

```text
provider_mode = pending_partner
```

Build:

```text
Signup ✅
Workspace ✅
Separate dashboards ✅
Contacts ✅
Campaigns ✅
Inbox ✅
Replies architecture ✅
Multiple session model ✅
Billing structure ✅
Tenant isolation ✅
```

When WASender approves you, change:

```text
pending_partner
```

to:

```text
partner
```

and implement the provider adapter.

The frontend variable names and database relationships **will not need to change**.

---

## The key rule from this point forward

Do not let Codex, Anti Gravity, frontend code or n8n invent new names.

For example, these are wrong:

```text
sessionId
waSessionId
senderId
company_id
customerWorkspace
campaign_id
```

in frontend/API JSON.

Use only:

```text
workspaceId
whatsappSessionId
campaignId
contactId
conversationId
```

And PostgreSQL always maps them to:

```text
workspace_id
whatsapp_session_id
campaign_id
workspace_contact_id
conversation_id
```

That single discipline will prevent a large portion of the integration problems you had with the first version.

**Next action:** run only **SQL Steps 2–8 first**. Then give Codex the backend prompt. When Codex returns `supabase-v2-runtime.sql` and the updated n8n JSON, send both to me **before running/importing them**. That is the point where we should validate the tenant-aware sending functions against your existing working lease/retry logic before touching production.