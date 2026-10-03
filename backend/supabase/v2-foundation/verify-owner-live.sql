SELECT jsonb_build_object(
 'ownerLinked',EXISTS(SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id=wm.workspace_id JOIN auth.users u ON u.id=wm.user_id WHERE w.slug='eightbit-solutions' AND wm.role='owner' AND lower(u.email)='khurram@eightbitsolutions.com'),
 'ownerProfileExists',EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.user_id WHERE lower(u.email)='khurram@eightbitsolutions.com'),
 'workspace',(SELECT jsonb_build_object('workspaceId',w.id,'companyName',w.company_name,'timezone',w.timezone,'subscriptionStatus',s.status,'planCode',s.plan_code) FROM public.workspaces w JOIN public.subscriptions s ON s.workspace_id=w.id WHERE w.slug='eightbit-solutions'),
 'legacySessions',(SELECT jsonb_agg(jsonb_build_object('whatsappSessionId',ws.id,'displayName',ws.display_name,'status',ws.status,'providerMode',pa.mode)) FROM outreach.whatsapp_sessions ws JOIN outreach.provider_accounts pa ON pa.id=ws.provider_account_id JOIN public.workspaces w ON w.id=ws.workspace_id WHERE w.slug='eightbit-solutions'),
 'campaignsWithoutWorkspace',(SELECT count(*) FROM outreach.campaigns WHERE workspace_id IS NULL),
 'contactsWithoutWorkspace',(SELECT count(*) FROM outreach.contacts WHERE workspace_id IS NULL),
 'messagesWithoutWorkspace',(SELECT count(*) FROM outreach.messages WHERE workspace_id IS NULL),
 'contactsWithoutMasterContact',(SELECT count(*) FROM outreach.contacts WHERE workspace_contact_id IS NULL),
 'messagesWithoutMasterContact',(SELECT count(*) FROM outreach.messages WHERE workspace_contact_id IS NULL),
 'providerMode',(SELECT value FROM outreach.platform_settings WHERE key='provider_mode'),
 'v1Health',outreach.api('{"action":"health"}'::jsonb),
 'v1FunctionHashes',(SELECT jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='outreach' AND p.proname IN ('api','claim_next','begin_send','finish_send','ingest_events','process_events','maintenance','complete_finished_campaign','complete_after_message_change'))
) AS owner_verification;
