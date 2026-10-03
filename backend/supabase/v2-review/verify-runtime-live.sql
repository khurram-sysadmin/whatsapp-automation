NOTIFY pgrst,'reload schema';
SELECT jsonb_build_object(
 'v1Health',outreach.api('{"action":"health"}'::jsonb),
 'v1FunctionHashes',(SELECT jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='outreach' AND p.proname IN ('api','claim_next','begin_send','finish_send','ingest_events','process_events','maintenance','complete_finished_campaign','complete_after_message_change')),
 'privateTables',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'anonRead',has_table_privilege('anon',c.oid,'SELECT'),'authenticatedRead',has_table_privilege('authenticated',c.oid,'SELECT'))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='outreach_v2' AND c.relkind='r'),
 'wrapperPermissions',(SELECT jsonb_agg(jsonb_build_object('function',p.proname,'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'eb_outreach_%_v2'),
 'vaultPrivate',NOT has_table_privilege('anon','vault.decrypted_secrets','SELECT') AND NOT has_table_privilege('authenticated','vault.decrypted_secrets','SELECT'),
 'ownerBootstrap',outreach_v2.api_v2('97475a32-a583-4a45-97ac-50f5d5bd3ecf','{"action":"bootstrap","requestId":"verify-live-bootstrap"}'::jsonb),
 'customerCampaignCount',(SELECT count(*) FROM outreach_v2.campaigns),
 'customerQueueCount',(SELECT count(*) FROM outreach_v2.messages)
) AS runtime_verification;