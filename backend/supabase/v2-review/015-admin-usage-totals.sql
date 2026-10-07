-- Owner-only aggregate reporting. No customer message content is returned.
-- Add the operator's Auth user ID to public.platform_admins after review; do not use email as authority.
BEGIN;
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION outreach_v2.admin_usage_v2(uid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=uid) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Platform admin access required';
  END IF;
  SELECT coalesce(jsonb_agg(row_to_json(q)::jsonb ORDER BY q.company_name), '[]'::jsonb) INTO result
  FROM (
    SELECT w.id AS workspace_id, w.company_name, w.created_by AS owner_user_id,
      u.email AS owner_email, coalesce(su.plan_code,'') AS plan_code,
      coalesce(su.status,'none') AS subscription_status, (to_jsonb(su)->>'trial_ends_at')::timestamptz AS trial_ends_at,
      w.status AS workspace_status, w.timezone,
      (SELECT count(*) FROM public.workspaces ow WHERE ow.created_by=w.created_by) AS owner_workspaces_total,
      coalesce((SELECT sum(um.messages_sent) FROM outreach.usage_monthly um WHERE um.workspace_id=w.id AND um.period_start=date_trunc('month',now())::date),0) AS messages_sent_month,
      coalesce((SELECT sum(um.messages_sent) FROM outreach.usage_monthly um WHERE um.workspace_id=w.id),0) AS messages_sent_lifetime,
      (SELECT count(*) FROM outreach.whatsapp_sessions ws WHERE ws.workspace_id=w.id AND ws.deleted_at IS NULL)::integer AS whatsapp_accounts_registered,
      (SELECT count(*) FROM outreach.whatsapp_sessions ws WHERE ws.workspace_id=w.id AND ws.deleted_at IS NULL AND ws.status='connected')::integer AS whatsapp_accounts_connected,
      (SELECT count(*) FROM outreach_v2.campaigns c WHERE c.workspace_id=w.id AND c.deleted_at IS NULL)::integer AS campaigns_total,
      (SELECT count(*) FROM outreach_v2.campaigns c WHERE c.workspace_id=w.id AND c.deleted_at IS NULL AND c.status='running')::integer AS campaigns_running,
      (SELECT count(*) FROM outreach_v2.campaigns c WHERE c.workspace_id=w.id AND c.deleted_at IS NULL AND c.status='completed')::integer AS campaigns_completed,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'campaignId',c.id,'campaignName',c.name,'status',c.status,
        'contacts', (SELECT count(*) FROM outreach_v2.contacts ct WHERE ct.campaign_id=c.id),
        'queued', (SELECT count(*) FROM outreach_v2.messages m WHERE m.campaign_id=c.id AND m.status IN ('queued','leased','dispatching')),
        'sent', (SELECT count(*) FROM outreach_v2.messages m WHERE m.campaign_id=c.id AND m.status IN ('sent','delivered','read')),
        'failed', (SELECT count(*) FROM outreach_v2.messages m WHERE m.campaign_id=c.id AND m.status='failed')
      ) ORDER BY c.created_at DESC) FROM outreach_v2.campaigns c WHERE c.workspace_id=w.id AND c.deleted_at IS NULL), '[]'::jsonb) AS campaigns
    FROM public.workspaces w
    LEFT JOIN auth.users u ON u.id=w.created_by
    LEFT JOIN public.subscriptions su ON su.workspace_id=w.id

  ) q;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION outreach_v2.admin_usage_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION outreach_v2.admin_usage_v2(uuid) TO service_role;

CREATE OR REPLACE FUNCTION outreach_v2.admin_user_usage_v2(uid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reports jsonb;
BEGIN
  reports:=outreach_v2.admin_usage_v2(uid);
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(q)::jsonb ORDER BY q.owner_email),'[]'::jsonb) FROM (
    SELECT u.id AS owner_user_id,u.email AS owner_email,u.created_at AS registered_at,
      (SELECT count(*) FROM public.workspaces w WHERE w.created_by=u.id) AS workspaces_total,
      coalesce((SELECT sum((r->>'campaigns_total')::bigint) FROM jsonb_array_elements(reports) r WHERE r->>'owner_user_id'=u.id::text),0) AS campaigns_total,
      coalesce((SELECT sum((r->>'campaigns_running')::bigint) FROM jsonb_array_elements(reports) r WHERE r->>'owner_user_id'=u.id::text),0) AS campaigns_running,
      coalesce((SELECT sum((r->>'whatsapp_accounts_registered')::bigint) FROM jsonb_array_elements(reports) r WHERE r->>'owner_user_id'=u.id::text),0) AS whatsapp_accounts_registered,
      coalesce((SELECT sum((r->>'messages_sent_month')::bigint) FROM jsonb_array_elements(reports) r WHERE r->>'owner_user_id'=u.id::text),0) AS messages_sent_month,
      coalesce((SELECT sum((r->>'messages_sent_lifetime')::bigint) FROM jsonb_array_elements(reports) r WHERE r->>'owner_user_id'=u.id::text),0) AS messages_sent_lifetime,
      coalesce((SELECT jsonb_agg(r) FROM jsonb_array_elements(reports) r WHERE r->>'owner_user_id'=u.id::text),'[]'::jsonb) AS workspaces
    FROM auth.users u
  ) q);
END $$;
REVOKE ALL ON FUNCTION outreach_v2.admin_user_usage_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION outreach_v2.admin_user_usage_v2(uuid) TO service_role;
COMMIT;
