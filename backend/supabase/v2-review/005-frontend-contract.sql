BEGIN;
CREATE OR REPLACE FUNCTION outreach_v2.api_v2(uid uuid,p jsonb,provider_proof jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a text:=p->>'action'; rid text:=coalesce(p->>'requestId','req_'||gen_random_uuid()::text); wid uuid; sid uuid; cid uuid; conv_id uuid;
 c outreach_v2.campaigns; s outreach.whatsapp_sessions; wc outreach.workspace_contacts; conv outreach.conversations;
 response jsonb; cached jsonb; digest text; safe_request jsonb; is_write boolean; scope_id uuid; n integer; amount integer; limit_n integer; offset_n integer;
 item jsonb; inserted_id uuid; account_id uuid; secret_id uuid; webhook_id uuid; v_phone text; body_text text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RETURN outreach_v2.result_v2(rid,NULL,'UNAUTHORIZED','Sign in again.'); END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR a IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Choose an action.'); END IF;
 IF a<>ALL(ARRAY['bootstrap','workspaceCreate','workspaceUpdate','profileUpdate','sessionList','sessionCreate','sessionConnect','sessionStatus','sessionDisconnect','sessionDelete','create','list','detail','start','pause','resume','stop','delete','stats','messages','contacts','templates','saveTemplate','suppress','inbox','conversation','reply','markConversationRead','subscription','usage','health','import']) THEN
  RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Unknown action.');
 END IF;
 wid:=nullif(p->>'workspaceId','')::uuid; IF a IN ('workspaceCreate','profileUpdate') THEN wid:=NULL; END IF; sid:=nullif(p->>'whatsappSessionId','')::uuid; cid:=nullif(p->>'campaignId','')::uuid; conv_id:=nullif(p->>'conversationId','')::uuid;
 is_write:=a=ANY(ARRAY['workspaceCreate','workspaceUpdate','profileUpdate','sessionCreate','sessionConnect','sessionDisconnect','sessionDelete','create','start','pause','resume','stop','delete','saveTemplate','suppress','reply','markConversationRead','import']);
 IF is_write AND (p->>'requestId' IS NULL OR length(p->>'requestId') NOT BETWEEN 8 AND 128) THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','requestId must contain 8–128 characters.'); END IF;
 IF wid IS NOT NULL AND NOT outreach_v2.allowed_v2(wid,uid) THEN RETURN outreach_v2.result_v2(rid,NULL,'FORBIDDEN','Workspace access denied.'); END IF;
 IF a<>ALL(ARRAY['bootstrap','workspaceCreate','profileUpdate']) AND wid IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','workspaceId is required.'); END IF;
 IF is_write AND wid IS NOT NULL THEN
  IF NOT outreach_v2.allowed_v2(wid,uid,CASE WHEN a=ANY(ARRAY['workspaceUpdate','sessionCreate','sessionConnect','sessionDisconnect','sessionDelete']) THEN ARRAY['owner','admin'] ELSE ARRAY['owner','admin','agent'] END) THEN RETURN outreach_v2.result_v2(rid,NULL,'FORBIDDEN','Your role cannot perform this action.'); END IF;
 END IF;
 IF is_write THEN PERFORM pg_advisory_xact_lock(hashtextextended('v2-api:'||coalesce(wid,uid)::text,0)); END IF;
 IF is_write THEN
  -- Serialize workspace mutations and session/campaign metadata changes. Worker locks are per session.
  scope_id:=coalesce(wid,uid); PERFORM pg_advisory_xact_lock(hashtextextended('v2-api:'||scope_id::text,0));
  safe_request:=p-ARRAY['apiSecret','webhookSecret','userId','providerProof'];
  IF p ? 'apiSecret' THEN safe_request:=safe_request||jsonb_build_object('apiSecretDigest',encode(sha256(convert_to(p->>'apiSecret','UTF8')),'hex')); END IF;
  IF p ? 'webhookSecret' THEN safe_request:=safe_request||jsonb_build_object('webhookSecretDigest',encode(sha256(convert_to(p->>'webhookSecret','UTF8')),'hex')); END IF;
  digest:=encode(sha256(convert_to(safe_request::text,'UTF8')),'hex');
  IF wid IS NULL THEN SELECT rq.response,rq.request_hash INTO cached,body_text FROM outreach_v2.user_requests rq WHERE user_id=uid AND request_key=rid;
  ELSE SELECT rq.response,rq.request_body->>'digest' INTO cached,body_text FROM outreach.api_requests_v2 rq WHERE workspace_id=wid AND request_key=rid; END IF;
  IF cached IS NOT NULL THEN IF body_text<>digest THEN RETURN outreach_v2.result_v2(rid,NULL,'REQUEST_CONFLICT','requestId was already used for different input.'); END IF; RETURN cached; END IF;
 END IF;
 IF cid IS NOT NULL THEN SELECT * INTO c FROM outreach_v2.campaigns WHERE id=cid AND workspace_id=wid; IF NOT FOUND THEN RETURN outreach_v2.result_v2(rid,NULL,'NOT_FOUND','Campaign not found.'); END IF; END IF;
 IF sid IS NOT NULL THEN SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=sid AND workspace_id=wid AND (deleted_at IS NULL OR a='sessionDelete'); IF NOT FOUND THEN RETURN outreach_v2.result_v2(rid,NULL,'NOT_FOUND','WhatsApp connection not found.'); END IF; END IF;
 IF conv_id IS NOT NULL THEN SELECT * INTO conv FROM outreach.conversations WHERE id=conv_id AND workspace_id=wid; IF NOT FOUND THEN RETURN outreach_v2.result_v2(rid,NULL,'NOT_FOUND','Conversation not found.'); END IF; END IF;
 IF is_write THEN
  IF sid IS NOT NULL THEN SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=sid AND workspace_id=wid FOR UPDATE;
  ELSIF cid IS NOT NULL THEN PERFORM 1 FROM outreach.whatsapp_sessions WHERE id=c.whatsapp_session_id FOR UPDATE;
  ELSIF conv_id IS NOT NULL THEN PERFORM 1 FROM outreach.whatsapp_sessions WHERE id=conv.whatsapp_session_id FOR UPDATE; END IF;
  IF cid IS NOT NULL THEN SELECT * INTO c FROM outreach_v2.campaigns WHERE id=cid AND workspace_id=wid FOR UPDATE; END IF;
  IF conv_id IS NOT NULL THEN SELECT * INTO conv FROM outreach.conversations WHERE id=conv_id AND workspace_id=wid FOR UPDATE; END IF;
 END IF;
 limit_n:=least(greatest(coalesce((p->>'limit')::integer,100),1),500); offset_n:=greatest(coalesce((p->>'offset')::integer,0),0);
 CASE a
 WHEN 'bootstrap' THEN
  SELECT jsonb_build_object('user',jsonb_build_object('userId',u.id,'email',u.email,'fullName',coalesce(pr.full_name,'')),'workspaces',coalesce((SELECT jsonb_agg(jsonb_build_object('workspaceId',w.id,'companyName',w.company_name,'timezone',w.timezone,'status',w.status,'role',m.role,'onboardingStep',w.onboarding_step) ORDER BY w.created_at) FROM public.workspaces w JOIN public.workspace_members m ON m.workspace_id=w.id WHERE m.user_id=uid),'[]'::jsonb),'currentWorkspaceId',(SELECT workspace_id FROM public.workspace_members WHERE user_id=uid ORDER BY joined_at LIMIT 1),'providerMode','customer_api_key') INTO response FROM auth.users u LEFT JOIN public.profiles pr ON pr.user_id=u.id WHERE u.id=uid;
 WHEN 'workspaceCreate' THEN
  IF length(btrim(coalesce(p->>'companyName',''))) NOT BETWEEN 1 AND 200 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=coalesce(p->>'timezone','Asia/Karachi')) THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter a company name and valid timezone.'); END IF;
  INSERT INTO public.workspaces(company_name,slug,timezone,created_by,onboarding_step) VALUES(btrim(p->>'companyName'),'company-'||gen_random_uuid(),coalesce(p->>'timezone','Asia/Karachi'),uid,'whatsapp') RETURNING id INTO inserted_id;
  INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(inserted_id,uid,'owner');
  INSERT INTO public.subscriptions(workspace_id,plan_code,status) VALUES(inserted_id,'beta','active');
  response:=jsonb_build_object('workspaceId',inserted_id);
 WHEN 'workspaceUpdate' THEN
  IF length(btrim(coalesce(p->>'companyName',''))) NOT BETWEEN 1 AND 200 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=coalesce(p->>'timezone','')) THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter a company name and valid timezone.'); END IF;
  UPDATE public.workspaces SET company_name=btrim(p->>'companyName'),timezone=p->>'timezone',updated_at=now() WHERE id=wid;
  response:=jsonb_build_object('workspaceId',wid,'companyName',btrim(p->>'companyName'),'timezone',p->>'timezone');
 WHEN 'profileUpdate' THEN
  IF length(coalesce(p->>'fullName',''))>200 THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Name is too long.'); END IF;
  INSERT INTO public.profiles(user_id,full_name) VALUES(uid,btrim(coalesce(p->>'fullName',''))) ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name,updated_at=now();
  response:=jsonb_build_object('userId',uid,'fullName',btrim(coalesce(p->>'fullName','')));
 WHEN 'sessionList' THEN
  SELECT coalesce(jsonb_agg(outreach_v2.session_json_v2(q) ORDER BY q.created_at),'[]'::jsonb) INTO response FROM outreach.whatsapp_sessions q WHERE workspace_id=wid AND deleted_at IS NULL;
 WHEN 'sessionCreate' THEN
  IF length(btrim(coalesce(p->>'displayName',''))) NOT BETWEEN 1 AND 200 THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Name this WhatsApp connection.'); END IF;
  SELECT pl.max_whatsapp_sessions INTO amount FROM public.subscriptions su JOIN public.plans pl ON pl.code=su.plan_code WHERE su.workspace_id=wid AND su.status IN ('active','trialing');
  IF NOT FOUND THEN RETURN outreach_v2.result_v2(rid,NULL,'SUBSCRIPTION_REQUIRED','An active subscription is required.'); END IF;
  IF amount IS NOT NULL AND (SELECT count(*) FROM outreach.whatsapp_sessions WHERE workspace_id=wid AND deleted_at IS NULL)>=amount THEN RETURN outreach_v2.result_v2(rid,NULL,'PLAN_LIMIT','Your plan connection limit has been reached.'); END IF;
  INSERT INTO outreach.provider_accounts(workspace_id,mode,display_name) VALUES(wid,'manual_session_key','Customer connection '||gen_random_uuid()) RETURNING id INTO account_id;
  INSERT INTO outreach.whatsapp_sessions(workspace_id,provider_account_id,display_name) VALUES(wid,account_id,btrim(p->>'displayName')) RETURNING * INTO s;
  INSERT INTO outreach.session_sender_settings(whatsapp_session_id) VALUES(s.id);
  response:=outreach_v2.session_json_v2(s);
 WHEN 'sessionConnect' THEN
  IF sid IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a connection.'); END IF;
  IF (SELECT mode FROM outreach.provider_accounts WHERE id=s.provider_account_id)<>'manual_session_key' THEN RETURN outreach_v2.result_v2(rid,NULL,'LEGACY_SESSION','Add a customer API connection; the existing v1 connection stays unchanged.'); END IF;
  IF (provider_proof->>'status') IS DISTINCT FROM 'connected' OR coalesce(provider_proof->>'phoneE164','') !~ '^\+[1-9][0-9]{7,14}$' THEN RETURN outreach_v2.result_v2(rid,NULL,'PROVIDER_NOT_CONNECTED','Connect this number in WASender and verify its session API key.'); END IF;
  IF length(coalesce(p->>'apiSecret','')) NOT BETWEEN 16 AND 2048 OR length(coalesce(p->>'webhookSecret','')) NOT BETWEEN 16 AND 2048 THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter the session API key and webhook secret from WASender.'); END IF;
  IF EXISTS(SELECT 1 FROM outreach_v2.messages WHERE whatsapp_session_id=sid AND status IN ('leased','dispatching','unknown')) THEN RETURN outreach_v2.result_v2(rid,NULL,'CONNECTION_BUSY','Resolve in-flight messages before changing this connection.'); END IF;
  v_phone:=provider_proof->>'phoneE164';
  IF s.phone_e164 IS NOT NULL AND s.phone_e164<>v_phone THEN RETURN outreach_v2.result_v2(rid,NULL,'CONNECTION_MISMATCH','This connection belongs to another number. Add a new connection for this number.'); END IF;
  IF EXISTS(SELECT 1 FROM outreach.whatsapp_sessions WHERE provider='wasender' AND provider_session_id=v_phone AND id<>sid) THEN RETURN outreach_v2.result_v2(rid,NULL,'CONNECTION_IN_USE','This WhatsApp number is already linked to another connection.'); END IF;
  IF EXISTS(SELECT 1 FROM outreach.whatsapp_sessions q JOIN vault.decrypted_secrets v ON v.id=q.webhook_secret_id WHERE q.id<>sid AND q.deleted_at IS NULL AND sha256(convert_to(v.decrypted_secret,'UTF8'))=sha256(convert_to(p->>'webhookSecret','UTF8'))) THEN RETURN outreach_v2.result_v2(rid,NULL,'WEBHOOK_SECRET_IN_USE','Use a different webhook secret for each WhatsApp connection.'); END IF;
  secret_id:=vault.create_secret(p->>'apiSecret','eightbit-api-'||sid||'-'||gen_random_uuid());
  webhook_id:=vault.create_secret(p->>'webhookSecret','eightbit-webhook-'||sid||'-'||gen_random_uuid());
  UPDATE outreach.whatsapp_sessions SET status='connected',provider_session_id=v_phone,phone_e164=v_phone,api_key_secret_id=secret_id,webhook_secret_id=webhook_id,last_seen_at=now(),updated_at=now(),is_default=NOT EXISTS(SELECT 1 FROM outreach.whatsapp_sessions q WHERE q.workspace_id=wid AND q.is_default AND q.id<>sid AND q.deleted_at IS NULL) WHERE id=sid RETURNING * INTO s;
  UPDATE outreach.session_sender_settings SET enabled=true WHERE whatsapp_session_id=sid;
  UPDATE public.workspaces SET onboarding_step='test' WHERE id=wid AND onboarding_step IN ('company','whatsapp');
  response:=outreach_v2.session_json_v2(s);
 WHEN 'sessionStatus' THEN
  IF sid IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a connection.'); END IF;
  IF provider_proof ? 'status' THEN UPDATE outreach.whatsapp_sessions SET status=CASE WHEN provider_proof->>'status'=ANY(ARRAY['connected','connecting','disconnected','expired']) THEN provider_proof->>'status' ELSE 'error' END,last_seen_at=now(),updated_at=now() WHERE id=sid RETURNING * INTO s; END IF;
  response:=outreach_v2.session_json_v2(s);
 WHEN 'sessionDisconnect','sessionDelete' THEN
  IF sid IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a connection.'); END IF;
  IF (SELECT mode FROM outreach.provider_accounts WHERE id=s.provider_account_id)<>'manual_session_key' THEN RETURN outreach_v2.result_v2(rid,NULL,'LEGACY_SESSION','The existing v1 connection is managed separately.'); END IF;
  IF EXISTS(SELECT 1 FROM outreach_v2.messages WHERE whatsapp_session_id=sid AND status IN ('leased','dispatching','unknown')) OR EXISTS(SELECT 1 FROM outreach_v2.campaigns WHERE whatsapp_session_id=sid AND status IN ('running','paused') AND deleted_at IS NULL) THEN RETURN outreach_v2.result_v2(rid,NULL,'CONNECTION_BUSY','Stop campaigns and resolve in-flight messages first.'); END IF;
  UPDATE outreach.whatsapp_sessions SET status='disconnected',api_key_secret_id=NULL,webhook_secret_id=NULL,is_default=false,deleted_at=CASE WHEN a='sessionDelete' THEN coalesce(deleted_at,now()) ELSE deleted_at END,provider_session_id=CASE WHEN a='sessionDelete' THEN NULL ELSE provider_session_id END,updated_at=now() WHERE id=sid RETURNING * INTO s;
  UPDATE outreach.session_sender_settings SET enabled=false WHERE whatsapp_session_id=sid;
  UPDATE outreach_v2.messages SET status='canceled',error='Connection removed' WHERE whatsapp_session_id=sid AND status='queued';
  UPDATE outreach.conversation_messages cm SET status='failed' WHERE cm.status='queued' AND EXISTS(SELECT 1 FROM outreach_v2.messages m WHERE m.conversation_message_id=cm.id AND m.whatsapp_session_id=sid AND m.status='canceled');
  response:=jsonb_build_object('whatsappSessionId',sid,'status','disconnected','removed',a='sessionDelete');
 WHEN 'create' THEN
  IF sid IS NULL OR s.status<>'connected' OR s.api_key_secret_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'PROVIDER_NOT_CONFIGURED','Connect a customer WASender API key first.'); END IF;
  IF length(btrim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(p->>'template','')) NOT BETWEEN 0 AND 4096 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=coalesce(p->>'timezone','')) OR (p->>'mediaType' IS NOT NULL AND p->>'mediaType' NOT IN ('image','video','audio','document')) OR (p->>'mediaType' IS NOT NULL AND coalesce(p->>'mediaUrl','') !~* '^https://') OR (p->>'mediaType' IS NULL AND length(coalesce(p->>'template',''))<1) THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Check campaign name, message, attachment and timezone.'); END IF;
  PERFORM outreach.personalize(p->>'template','{}'::jsonb);
  INSERT INTO outreach_v2.campaigns(workspace_id,whatsapp_session_id,created_by,name,template,media_type,media_url,media_mime,media_filename,media_size_bytes,timezone,sending_start_time,sending_end_time,send_interval_seconds) VALUES(wid,sid,uid,btrim(p->>'name'),coalesce(p->>'template',''),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::integer,p->>'timezone',(p->>'sendingStartTime')::time,(p->>'sendingEndTime')::time,(p->>'sendIntervalSeconds')::integer) RETURNING * INTO c;
  response:=outreach_v2.campaign_json_v2(c);
 WHEN 'list' THEN
  SELECT coalesce(jsonb_agg(outreach_v2.campaign_json_v2(q)),'[]'::jsonb) INTO response FROM (SELECT * FROM outreach_v2.campaigns WHERE workspace_id=wid AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'detail' THEN
  IF cid IS NULL OR c.deleted_at IS NOT NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'NOT_FOUND','Campaign not found.'); END IF; response:=outreach_v2.campaign_json_v2(c);
 WHEN 'start','pause','resume','stop','delete' THEN
  IF cid IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','campaignId is required.'); END IF;
  IF c.deleted_at IS NOT NULL AND a<>'delete' THEN RETURN outreach_v2.result_v2(rid,NULL,'CAMPAIGN_ARCHIVED','Campaign is archived.'); END IF;
  PERFORM outreach_v2.complete_v2(cid); SELECT * INTO c FROM outreach_v2.campaigns WHERE id=cid;
  IF a='delete' THEN
   IF c.status='running' THEN RETURN outreach_v2.result_v2(rid,NULL,'STOP_REQUIRED','Stop this campaign before deleting it.'); END IF;
   UPDATE outreach_v2.campaigns SET deleted_at=coalesce(deleted_at,now()) WHERE id=cid;
   UPDATE outreach_v2.messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Campaign archived' WHERE campaign_id=cid AND status IN ('queued','leased');
  ELSIF c.status='completed' THEN
   IF a='start' THEN RETURN outreach_v2.result_v2(rid,NULL,'CAMPAIGN_COMPLETED','Completed campaigns cannot restart. Create another campaign.'); END IF;
  ELSIF a='start' THEN
   IF c.status<>'draft' THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_STATE','Only a draft campaign can start.'); END IF;
   SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=c.whatsapp_session_id AND workspace_id=wid AND deleted_at IS NULL;
   IF s.status<>'connected' OR s.api_key_secret_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'PROVIDER_NOT_CONNECTED','The selected WhatsApp connection is not ready.'); END IF;
   IF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE workspace_id=wid AND status IN ('active','trialing')) THEN RETURN outreach_v2.result_v2(rid,NULL,'SUBSCRIPTION_REQUIRED','An active subscription is required.'); END IF;
   INSERT INTO outreach_v2.messages(workspace_id,whatsapp_session_id,campaign_id,contact_id,workspace_contact_id,phone_e164,personalized_message,media_type,media_url,media_mime,media_filename,media_size_bytes)
   SELECT wid,c.whatsapp_session_id,cid,ct.id,wc2.id,wc2.phone_e164,outreach.personalize(c.template,to_jsonb(wc2)||jsonb_build_object('phone',wc2.phone_e164)),c.media_type,c.media_url,c.media_mime,c.media_filename,c.media_size_bytes FROM outreach_v2.contacts ct JOIN outreach.workspace_contacts wc2 ON wc2.id=ct.workspace_contact_id AND wc2.workspace_id=wid WHERE ct.campaign_id=cid AND ct.status='valid' AND NOT EXISTS(SELECT 1 FROM outreach.workspace_suppressions su WHERE su.workspace_id=wid AND su.phone_e164=wc2.phone_e164) ON CONFLICT(contact_id) DO NOTHING;
   GET DIAGNOSTICS n=ROW_COUNT; IF n=0 THEN RETURN outreach_v2.result_v2(rid,NULL,'NO_CONTACTS','Import eligible contacts before starting.'); END IF;
   UPDATE outreach_v2.contacts SET status='queued' WHERE campaign_id=cid AND status='valid' AND EXISTS(SELECT 1 FROM outreach_v2.messages m WHERE m.contact_id=outreach_v2.contacts.id);
   UPDATE outreach_v2.campaigns SET status='running',started_at=now(),next_send_at=now() WHERE id=cid;
   INSERT INTO outreach.usage_monthly(workspace_id,period_start,campaigns_started) VALUES(wid,date_trunc('month',now())::date,1) ON CONFLICT(workspace_id,period_start) DO UPDATE SET campaigns_started=outreach.usage_monthly.campaigns_started+1;
  ELSIF a='pause' THEN
   IF c.status<>'running' THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_STATE','Only a running campaign can pause.'); END IF; UPDATE outreach_v2.campaigns SET status='paused' WHERE id=cid;
  ELSIF a='resume' THEN
   IF c.status<>'paused' THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_STATE','Only a paused campaign can resume.'); END IF; UPDATE outreach_v2.campaigns SET status='running' WHERE id=cid;
  ELSE
   UPDATE outreach_v2.campaigns SET status='stopped' WHERE id=cid;
   UPDATE outreach_v2.messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Campaign stopped' WHERE campaign_id=cid AND status IN ('queued','leased');
  END IF;
  SELECT outreach_v2.campaign_json_v2(q) INTO response FROM outreach_v2.campaigns q WHERE id=cid;
 WHEN 'import' THEN
  IF cid IS NULL OR c.status<>'draft' OR c.deleted_at IS NOT NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_STATE','Import into a draft campaign.'); END IF;
  IF jsonb_typeof(p->'contacts')<>'array' OR jsonb_array_length(p->'contacts') NOT BETWEEN 1 AND 5000 THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Import 1–5000 validated contacts.'); END IF;
  SELECT pl.max_contacts INTO amount FROM public.subscriptions su JOIN public.plans pl ON pl.code=su.plan_code WHERE su.workspace_id=wid;
  IF amount IS NOT NULL AND (SELECT count(*) FROM outreach.workspace_contacts WHERE workspace_id=wid)+(SELECT count(DISTINCT x->>'phoneE164') FROM jsonb_array_elements(p->'contacts') x WHERE NOT EXISTS(SELECT 1 FROM outreach.workspace_contacts wc3 WHERE wc3.workspace_id=wid AND wc3.phone_e164=x->>'phoneE164'))>amount THEN RETURN outreach_v2.result_v2(rid,NULL,'PLAN_LIMIT','Your contact limit would be exceeded.'); END IF;
  n:=0;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'contacts') LOOP
   IF jsonb_typeof(item)<>'object' OR EXISTS(SELECT 1 FROM jsonb_each_text(item) v WHERE length(v.value)>CASE WHEN v.key='email' THEN 254 ELSE 200 END OR v.value ~ '\{\{|\}\}') THEN RAISE EXCEPTION 'Invalid contact fields'; END IF;
   IF coalesce(item->>'phoneE164','') !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Invalid phone'; END IF;
   INSERT INTO outreach.workspace_contacts(workspace_id,phone_e164,name,first_name,company,email,city,industry) VALUES(wid,item->>'phoneE164',coalesce(item->>'name',''),coalesce(item->>'firstName',''),coalesce(item->>'company',''),coalesce(item->>'email',''),coalesce(item->>'city',''),coalesce(item->>'industry','')) ON CONFLICT(workspace_id,phone_e164) DO UPDATE SET name=EXCLUDED.name,first_name=EXCLUDED.first_name,company=EXCLUDED.company,email=EXCLUDED.email,city=EXCLUDED.city,industry=EXCLUDED.industry,updated_at=now() RETURNING * INTO wc;
   INSERT INTO outreach_v2.contacts(workspace_id,campaign_id,workspace_contact_id,status) VALUES(wid,cid,wc.id,CASE WHEN EXISTS(SELECT 1 FROM outreach.workspace_suppressions WHERE workspace_id=wid AND phone_e164=wc.phone_e164) THEN 'opted_out' ELSE 'valid' END) ON CONFLICT(campaign_id,workspace_contact_id) DO NOTHING;
   IF FOUND THEN n:=n+1; END IF;
  END LOOP;
  INSERT INTO outreach.usage_monthly(workspace_id,period_start,contacts_imported) VALUES(wid,date_trunc('month',now())::date,n) ON CONFLICT(workspace_id,period_start) DO UPDATE SET contacts_imported=outreach.usage_monthly.contacts_imported+n;
  response:=jsonb_build_object('campaignId',cid,'imported',n);
 WHEN 'contacts' THEN
  SELECT coalesce(jsonb_agg(outreach_v2.contact_json_v2(q)),'[]'::jsonb) INTO response FROM (SELECT wc2.* FROM outreach.workspace_contacts wc2 WHERE workspace_id=wid AND (cid IS NULL OR EXISTS(SELECT 1 FROM outreach_v2.contacts ct WHERE ct.campaign_id=cid AND ct.workspace_contact_id=wc2.id)) ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'messages' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('messageId',q.id,'campaignId',q.campaign_id,'whatsappSessionId',q.whatsapp_session_id,'contactId',q.workspace_contact_id,'phoneE164',q.phone_e164,'personalizedMessage',q.personalized_message,'mediaType',q.media_type,'mediaUrl',q.media_url,'mediaMime',q.media_mime,'mediaFilename',q.media_filename,'status',q.status,'createdAt',q.created_at,'sentAt',q.sent_at,'error',q.error)),'[]'::jsonb) INTO response FROM (SELECT * FROM outreach_v2.messages WHERE workspace_id=wid AND (cid IS NULL OR campaign_id=cid) AND (campaign_id IS NULL OR EXISTS(SELECT 1 FROM outreach_v2.campaigns ca WHERE ca.id=campaign_id AND ca.deleted_at IS NULL)) ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'stats' THEN
  SELECT jsonb_build_object('totalContacts',(SELECT count(*) FROM outreach.workspace_contacts WHERE workspace_id=wid),'campaigns',(SELECT count(*) FROM outreach_v2.campaigns WHERE workspace_id=wid AND deleted_at IS NULL),'queued',count(*) FILTER(WHERE m.status IN ('queued','leased')),'sending',count(*) FILTER(WHERE m.status='dispatching'),'sent',count(*) FILTER(WHERE m.sent_at IS NOT NULL),'delivered',count(*) FILTER(WHERE m.delivered_at IS NOT NULL),'read',count(*) FILTER(WHERE m.read_at IS NOT NULL),'failed',count(*) FILTER(WHERE m.status='failed'),'needsReview',count(*) FILTER(WHERE m.status='unknown'),'replied',(SELECT count(*) FROM outreach.conversation_messages cm WHERE cm.workspace_id=wid AND cm.direction='inbound'),'optedOut',(SELECT count(*) FROM outreach.workspace_suppressions WHERE workspace_id=wid)) INTO response FROM outreach_v2.messages m JOIN outreach_v2.campaigns ca ON ca.id=m.campaign_id WHERE m.workspace_id=wid AND ca.deleted_at IS NULL AND (cid IS NULL OR m.campaign_id=cid);
 WHEN 'templates' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('templateId',q.id,'name',q.name,'body',q.body)),'[]'::jsonb) INTO response FROM (SELECT * FROM outreach.workspace_templates WHERE workspace_id=wid ORDER BY created_at DESC LIMIT limit_n OFFSET offset_n) q;
 WHEN 'saveTemplate' THEN
  IF length(btrim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(p->>'body','')) NOT BETWEEN 1 AND 4096 THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter a template name and body.'); END IF;
  PERFORM outreach.personalize(p->>'body','{}'::jsonb);
  INSERT INTO outreach.workspace_templates(workspace_id,name,body) VALUES(wid,btrim(p->>'name'),p->>'body') ON CONFLICT(workspace_id,name) DO UPDATE SET body=EXCLUDED.body,updated_at=now() RETURNING id INTO inserted_id;
  response:=jsonb_build_object('templateId',inserted_id,'name',btrim(p->>'name'),'body',p->>'body');
 WHEN 'suppress' THEN
  v_phone:=p->>'phoneE164'; IF coalesce(v_phone,'') !~ '^\+[1-9][0-9]{7,14}$' OR length(coalesce(p->>'reason','')) NOT BETWEEN 1 AND 500 THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter an international phone and reason.'); END IF;
  INSERT INTO outreach.workspace_suppressions(workspace_id,phone_e164,reason) VALUES(wid,v_phone,p->>'reason') ON CONFLICT(workspace_id,phone_e164) DO NOTHING;
  UPDATE outreach.workspace_contacts SET status='opted_out' WHERE workspace_id=wid AND phone_e164=v_phone;
  UPDATE outreach_v2.messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Recipient suppressed' WHERE workspace_id=wid AND phone_e164=v_phone AND status IN ('queued','leased');
  FOR inserted_id IN SELECT id FROM outreach_v2.campaigns WHERE workspace_id=wid AND status IN ('running','paused') LOOP PERFORM outreach_v2.complete_v2(inserted_id); END LOOP;
  response:=jsonb_build_object('phoneE164',v_phone,'suppressed',true);
 WHEN 'inbox' THEN
  SELECT coalesce(jsonb_agg(q.data),'[]'::jsonb) INTO response FROM (SELECT jsonb_build_object('conversationId',co.id,'whatsappSessionId',co.whatsapp_session_id,'contact',outreach_v2.contact_json_v2(wc2),'lastMessage',co.last_message_preview,'lastMessageAt',co.last_message_at,'unreadCount',co.unread_count) data FROM outreach.conversations co JOIN outreach.workspace_contacts wc2 ON wc2.id=co.workspace_contact_id AND wc2.workspace_id=wid WHERE co.workspace_id=wid ORDER BY co.last_message_at DESC NULLS LAST,co.id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'conversation' THEN
  IF conv_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a conversation.'); END IF;
  SELECT jsonb_build_object('conversationId',conv.id,'whatsappSessionId',conv.whatsapp_session_id,'contact',outreach_v2.contact_json_v2(wc2),'messages',coalesce((SELECT jsonb_agg(jsonb_build_object('messageId',q.id,'direction',q.direction,'body',q.body,'mediaType',q.media_type,'mediaUrl',q.media_url,'mediaMime',q.media_mime,'mediaFilename',q.media_filename,'status',q.status,'createdAt',q.created_at) ORDER BY q.created_at,q.id) FROM (SELECT * FROM outreach.conversation_messages WHERE conversation_id=conv_id AND workspace_id=wid ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q),'[]'::jsonb)) INTO response FROM outreach.workspace_contacts wc2 WHERE wc2.id=conv.workspace_contact_id AND wc2.workspace_id=wid;
 WHEN 'reply' THEN
  IF conv_id IS NULL OR length(btrim(coalesce(p->>'text',''))) NOT BETWEEN 0 AND 4096 OR (length(btrim(coalesce(p->>'text','')))=0 AND p->>'mediaType' IS NULL) OR (p->>'mediaType' IS NOT NULL AND p->>'mediaType' NOT IN ('image','video','audio','document')) OR (p->>'mediaType' IS NOT NULL AND coalesce(p->>'mediaUrl','') !~* '^https://') THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter a reply or attach a valid media file.'); END IF;
  SELECT * INTO wc FROM outreach.workspace_contacts WHERE id=conv.workspace_contact_id AND workspace_id=wid;
  SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=conv.whatsapp_session_id AND workspace_id=wid AND deleted_at IS NULL;
  IF s.status<>'connected' OR s.api_key_secret_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'PROVIDER_NOT_CONNECTED','The conversation WhatsApp connection is not ready.'); END IF;
  IF EXISTS(SELECT 1 FROM outreach.workspace_suppressions WHERE workspace_id=wid AND phone_e164=wc.phone_e164) THEN RETURN outreach_v2.result_v2(rid,NULL,'RECIPIENT_SUPPRESSED','This contact has opted out.'); END IF;
  INSERT INTO outreach.conversation_messages(workspace_id,conversation_id,whatsapp_session_id,workspace_contact_id,direction,body,media_type,media_url,media_mime,media_filename,media_size_bytes,status) VALUES(wid,conv_id,conv.whatsapp_session_id,wc.id,'outbound',btrim(p->>'text'),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::integer,'queued') RETURNING id INTO inserted_id;
  INSERT INTO outreach_v2.messages(workspace_id,whatsapp_session_id,workspace_contact_id,conversation_message_id,phone_e164,personalized_message,media_type,media_url,media_mime,media_filename,media_size_bytes) VALUES(wid,conv.whatsapp_session_id,wc.id,inserted_id,wc.phone_e164,btrim(p->>'text'),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::integer);
  UPDATE outreach.conversations SET last_message_preview=left(btrim(p->>'text'),200),last_message_at=now(),updated_at=now() WHERE id=conv_id;
  response:=jsonb_build_object('messageId',inserted_id,'conversationId',conv_id,'status','queued');
 WHEN 'markConversationRead' THEN
  IF conv_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a conversation.'); END IF;
  UPDATE outreach.conversations SET unread_count=0,updated_at=now() WHERE id=conv_id; response:=jsonb_build_object('conversationId',conv_id,'unreadCount',0);
 WHEN 'subscription' THEN SELECT jsonb_build_object('planCode',su.plan_code,'status',su.status,'whatsappSessionLimit',pl.max_whatsapp_sessions,'teamMemberLimit',pl.max_team_members,'contactLimit',pl.max_contacts,'monthlyMessageLimit',pl.max_monthly_messages) INTO response FROM public.subscriptions su JOIN public.plans pl ON pl.code=su.plan_code WHERE su.workspace_id=wid;
 WHEN 'usage' THEN SELECT jsonb_build_object('messagesSent',coalesce(q.messages_sent,0),'campaignsStarted',coalesce(q.campaigns_started,0),'contactsImported',coalesce(q.contacts_imported,0)) INTO response FROM (SELECT 1) seed LEFT JOIN outreach.usage_monthly q ON q.workspace_id=wid AND q.period_start=date_trunc('month',now())::date;
 WHEN 'health' THEN response:=jsonb_build_object('backendReady',true,'providerMode','customer_api_key','schemaVersion',2);
 END CASE;
 response:=outreach_v2.result_v2(rid,coalesce(response,'{}'::jsonb));
 IF is_write THEN
  IF wid IS NULL THEN INSERT INTO outreach_v2.user_requests(user_id,request_key,request_hash,response) VALUES(uid,rid,digest,response);
  ELSE INSERT INTO outreach.api_requests_v2(workspace_id,request_key,request_body,response) VALUES(wid,rid,jsonb_build_object('digest',digest,'action',a),response); END IF;
 END IF;
 RETURN response;
EXCEPTION WHEN invalid_text_representation OR check_violation OR not_null_violation OR invalid_datetime_format OR datetime_field_overflow OR raise_exception OR unique_violation OR foreign_key_violation THEN
 RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Check the request fields and current state.');
END $$;

COMMIT;
NOTIFY pgrst,'reload schema';
