CREATE OR REPLACE FUNCTION outreach_v2.authorize_connection_v2(uid uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE wid uuid:=(p->>'workspaceId')::uuid; sid uuid:=(p->>'whatsappSessionId')::uuid; s outreach.whatsapp_sessions; api_key text;
BEGIN
 IF p->>'action' NOT IN ('sessionConnect','sessionStatus') OR NOT outreach_v2.allowed_v2(wid,uid,CASE WHEN p->>'action'='sessionConnect' THEN ARRAY['owner','admin'] ELSE ARRAY['owner','admin','agent','viewer'] END) THEN RETURN jsonb_build_object('allowed',false); END IF;
 SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=sid AND workspace_id=wid AND deleted_at IS NULL;
 IF NOT FOUND OR (SELECT mode FROM outreach.provider_accounts WHERE id=s.provider_account_id)<>'manual_session_key' THEN RETURN jsonb_build_object('allowed',false); END IF;
 IF p->>'action'='sessionStatus' THEN SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE id=s.api_key_secret_id; END IF;
 RETURN jsonb_build_object('allowed',true,'apiSecret',api_key);
END $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_authorize_connection_v2(user_id uuid,p jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT outreach_v2.authorize_connection_v2(user_id,p); $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_authorize_import_v2(user_id uuid,workspace_id uuid,campaign_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT outreach_v2.allowed_v2(workspace_id,user_id,ARRAY['owner','admin','agent']) AND EXISTS(SELECT 1 FROM outreach_v2.campaigns WHERE id=campaign_id AND workspace_id=workspace_id AND status='draft' AND deleted_at IS NULL);
$$;
