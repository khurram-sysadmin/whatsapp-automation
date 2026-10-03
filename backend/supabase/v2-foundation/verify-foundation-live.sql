SELECT jsonb_build_object(
 'identityTableCount',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('profiles','workspaces','workspace_members','plans','subscriptions')),
 'privateTableCount',(SELECT count(*) FROM information_schema.tables WHERE table_schema='outreach' AND table_name IN ('platform_settings','provider_accounts','whatsapp_sessions','session_sender_settings','workspace_contacts','workspace_suppressions','workspace_templates','conversations','conversation_messages','usage_monthly','api_requests_v2','platform_admins')),
 'rlsEnabledTableCount',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relrowsecurity AND ((n.nspname='public' AND c.relname IN ('profiles','workspaces','workspace_members','plans','subscriptions')) OR (n.nspname='outreach' AND c.relname IN ('platform_settings','provider_accounts','whatsapp_sessions','session_sender_settings','workspace_contacts','workspace_suppressions','workspace_templates','conversations','conversation_messages','usage_monthly','api_requests_v2','platform_admins')))),
 'browserPrivateTableGrants',(SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='outreach' AND grantee IN ('anon','authenticated','PUBLIC')),
 'vaultInstalled',EXISTS(SELECT 1 FROM pg_extension WHERE extname='supabase_vault'),
 'providerMode',(SELECT value FROM outreach.platform_settings WHERE key='provider_mode'),
 'v1Counts',jsonb_build_object('campaigns',(SELECT count(*) FROM outreach.campaigns),'contacts',(SELECT count(*) FROM outreach.contacts),'messages',(SELECT count(*) FROM outreach.messages)),
 'v1Health',outreach.api('{"action":"health"}'::jsonb),
 'v1FunctionHashes',(SELECT jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='outreach' AND p.proname IN ('api','claim_next','begin_send','finish_send','ingest_events','process_events','maintenance','complete_finished_campaign','complete_after_message_change')),
 'ownerExists',EXISTS(SELECT 1 FROM auth.users WHERE lower(email)='khurram@eightbitsolutions.com')
) AS foundation_verification;
