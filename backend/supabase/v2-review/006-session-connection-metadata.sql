-- Add provider mode to existing session responses; no privileges changed.
BEGIN;
CREATE OR REPLACE FUNCTION outreach_v2.session_json_v2(s outreach.whatsapp_sessions) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('whatsappSessionId',s.id,'displayName',s.display_name,'phoneE164',s.phone_e164,'status',s.status,'isDefault',s.is_default,'providerAccountId',s.provider_account_id,'providerMode',(SELECT mode FROM outreach.provider_accounts WHERE id=s.provider_account_id),'configured',s.api_key_secret_id IS NOT NULL,'webhookReady',s.last_webhook_at IS NOT NULL,'webhookUrl','https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/provider-webhook?whatsappSessionId='||s.id);
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
