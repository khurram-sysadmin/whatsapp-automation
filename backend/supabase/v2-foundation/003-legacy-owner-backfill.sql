DO $$
DECLARE
    v_user uuid := '97475a32-a583-4a45-97ac-50f5d5bd3ecf'::uuid;

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
