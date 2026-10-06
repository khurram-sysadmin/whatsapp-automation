-- Owner-only aggregate reporting for the isolated staging project.
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
      coalesce(su.status,'none') AS subscription_status, su.trial_ends_at,
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
    WHERE w.status='active'
  ) q;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION outreach_v2.admin_usage_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION outreach_v2.admin_usage_v2(uuid) TO authenticated;
COMMIT;
