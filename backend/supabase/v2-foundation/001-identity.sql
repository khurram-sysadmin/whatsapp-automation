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
