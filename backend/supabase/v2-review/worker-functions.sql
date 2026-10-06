-- Build source: concatenated into supabase-v2-runtime.sql before the service-role grants.
CREATE OR REPLACE FUNCTION outreach_v2.claim_next_v2() RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s outreach.whatsapp_sessions; m outreach_v2.messages;
BEGIN
 FOR s IN SELECT ws.* FROM outreach.whatsapp_sessions ws JOIN outreach.session_sender_settings cfg ON cfg.whatsapp_session_id=ws.id JOIN public.workspaces w ON w.id=ws.workspace_id JOIN public.subscriptions su ON su.workspace_id=w.id JOIN public.plans pl ON pl.code=su.plan_code
 WHERE ws.deleted_at IS NULL AND ws.status='connected' AND ws.api_key_secret_id IS NOT NULL AND cfg.enabled AND cfg.next_send_at<=now() AND w.status='active' AND (su.status='active' OR (su.status='trialing' AND (su.trial_ends_at IS NULL OR su.trial_ends_at>now()))) AND pl.active
 AND (pl.max_monthly_messages IS NULL OR coalesce((SELECT messages_sent FROM outreach.usage_monthly WHERE workspace_id=w.id AND period_start=date_trunc('month',now())::date),0)+(SELECT count(*) FROM outreach_v2.messages x WHERE x.workspace_id=w.id AND x.status IN ('leased','dispatching','unknown'))<pl.max_monthly_messages)
 ORDER BY cfg.next_send_at,ws.id LIMIT 20 FOR UPDATE OF ws SKIP LOCKED LOOP
  IF EXISTS(SELECT 1 FROM outreach_v2.messages WHERE whatsapp_session_id=s.id AND status IN ('leased','dispatching','unknown')) THEN CONTINUE; END IF;
  SELECT q.* INTO m FROM outreach_v2.messages q LEFT JOIN outreach_v2.campaigns ca ON ca.id=q.campaign_id
  WHERE q.workspace_id=s.workspace_id AND q.whatsapp_session_id=s.id AND q.status='queued' AND q.scheduled_at<=now() AND q.attempts<3
  AND (q.campaign_id IS NULL OR (ca.workspace_id=s.workspace_id AND ca.whatsapp_session_id=s.id AND ca.status='running' AND ca.deleted_at IS NULL AND ca.next_send_at<=now()
   AND CASE WHEN ca.sending_start_time=ca.sending_end_time THEN true WHEN ca.sending_start_time<ca.sending_end_time THEN (now() AT TIME ZONE ca.timezone)::time>=ca.sending_start_time AND (now() AT TIME ZONE ca.timezone)::time<ca.sending_end_time ELSE (now() AT TIME ZONE ca.timezone)::time>=ca.sending_start_time OR (now() AT TIME ZONE ca.timezone)::time<ca.sending_end_time END))
  AND NOT EXISTS(SELECT 1 FROM outreach.workspace_suppressions su WHERE su.workspace_id=q.workspace_id AND su.phone_e164=q.phone_e164)
  ORDER BY q.scheduled_at,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
  IF FOUND THEN
   UPDATE outreach_v2.messages SET status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' WHERE id=m.id RETURNING * INTO m;
   RETURN NEXT jsonb_build_object('messageId',m.id,'leaseToken',m.lease_token,'workspaceId',m.workspace_id,'campaignId',m.campaign_id,'whatsappSessionId',m.whatsapp_session_id,'contactId',m.workspace_contact_id,'phoneE164',m.phone_e164,'personalizedMessage',m.personalized_message,'mediaType',m.media_type,'mediaUrl',m.media_url,'mediaMime',m.media_mime,'mediaFilename',m.media_filename,'mediaSizeBytes',m.media_size_bytes);
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION outreach_v2.begin_send_v2(mid uuid,token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m outreach_v2.messages; s outreach.whatsapp_sessions; c outreach_v2.campaigns; cfg outreach.session_sender_settings; api_key text;
BEGIN
 SELECT * INTO m FROM outreach_v2.messages WHERE id=mid AND lease_token=token AND status='leased' AND lease_until>now(); IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
 SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=m.whatsapp_session_id AND workspace_id=m.workspace_id FOR UPDATE;
 SELECT * INTO m FROM outreach_v2.messages WHERE id=mid AND lease_token=token AND status='leased' AND lease_until>now() FOR UPDATE; IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('v2-quota:'||m.workspace_id::text,0));
 IF EXISTS(SELECT 1 FROM public.subscriptions su JOIN public.plans pl ON pl.code=su.plan_code WHERE su.workspace_id=m.workspace_id AND (NOT pl.active OR (pl.max_monthly_messages IS NOT NULL AND coalesce((SELECT messages_sent FROM outreach.usage_monthly WHERE workspace_id=m.workspace_id AND period_start=date_trunc('month',now())::date),0)+(SELECT count(*) FROM outreach_v2.messages q WHERE q.workspace_id=m.workspace_id AND q.id<>mid AND q.status IN ('dispatching','unknown'))>=pl.max_monthly_messages))) THEN UPDATE outreach_v2.messages SET status='queued',lease_token=NULL,lease_until=NULL WHERE id=mid; RETURN '{}'::jsonb; END IF;
 SELECT * INTO cfg FROM outreach.session_sender_settings WHERE whatsapp_session_id=s.id FOR UPDATE;
 SELECT * INTO c FROM outreach_v2.campaigns WHERE id=m.campaign_id;
 IF EXISTS(SELECT 1 FROM outreach.workspace_suppressions WHERE workspace_id=m.workspace_id AND phone_e164=m.phone_e164) OR (m.campaign_id IS NOT NULL AND (c.deleted_at IS NOT NULL OR c.status='stopped')) THEN
  UPDATE outreach_v2.messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Campaign stopped or recipient suppressed' WHERE id=mid; PERFORM outreach_v2.complete_v2(m.campaign_id); RETURN '{}'::jsonb;
 END IF;
 IF s.status<>'connected' OR s.deleted_at IS NOT NULL OR s.api_key_secret_id IS NULL OR NOT cfg.enabled OR cfg.next_send_at>now()
 OR NOT EXISTS(SELECT 1 FROM public.workspaces w JOIN public.subscriptions su ON su.workspace_id=w.id WHERE w.id=m.workspace_id AND w.status='active' AND (su.status='active' OR (su.status='trialing' AND (su.trial_ends_at IS NULL OR su.trial_ends_at>now()))))
 OR EXISTS(SELECT 1 FROM outreach_v2.messages q WHERE q.whatsapp_session_id=s.id AND q.id<>mid AND q.status IN ('dispatching','unknown'))
 OR (m.campaign_id IS NOT NULL AND (c.status<>'running' OR c.next_send_at>now() OR NOT CASE WHEN c.sending_start_time=c.sending_end_time THEN true WHEN c.sending_start_time<c.sending_end_time THEN (now() AT TIME ZONE c.timezone)::time>=c.sending_start_time AND (now() AT TIME ZONE c.timezone)::time<c.sending_end_time ELSE (now() AT TIME ZONE c.timezone)::time>=c.sending_start_time OR (now() AT TIME ZONE c.timezone)::time<c.sending_end_time END)) THEN
  UPDATE outreach_v2.messages SET status='queued',lease_token=NULL,lease_until=NULL WHERE id=mid; RETURN '{}'::jsonb;
 END IF;
 SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE id=s.api_key_secret_id;
 IF api_key IS NULL THEN UPDATE outreach_v2.messages SET status='queued',lease_token=NULL,lease_until=NULL WHERE id=mid; RETURN '{}'::jsonb; END IF;
 UPDATE outreach.session_sender_settings SET next_send_at=now()+make_interval(secs=>min_interval_seconds) WHERE whatsapp_session_id=s.id;
 UPDATE outreach_v2.campaigns SET next_send_at=now()+make_interval(secs=>send_interval_seconds) WHERE id=m.campaign_id;
 UPDATE outreach_v2.messages SET status='dispatching',attempts=attempts+1,provider_response=NULL,dispatch_started_at=now(),lease_until=now()+interval '5 minutes' WHERE id=mid;
 RETURN jsonb_build_object('messageId',m.id,'leaseToken',token,'workspaceId',m.workspace_id,'campaignId',m.campaign_id,'whatsappSessionId',s.id,'contactId',m.workspace_contact_id,'phoneE164',m.phone_e164,'personalizedMessage',m.personalized_message,'mediaType',m.media_type,'mediaUrl',m.media_url,'mediaMime',m.media_mime,'mediaFilename',m.media_filename,'mediaSizeBytes',m.media_size_bytes,'apiSecret',api_key);
END $$;
CREATE OR REPLACE FUNCTION outreach_v2.finish_send_v2(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m outreach_v2.messages; state text; outcome text:=p->>'outcome'; convo uuid; outbound uuid;
BEGIN
 PERFORM 1 FROM outreach.whatsapp_sessions s WHERE s.id=(SELECT whatsapp_session_id FROM outreach_v2.messages WHERE id=(p->>'messageId')::uuid) FOR UPDATE;
 SELECT * INTO m FROM outreach_v2.messages WHERE id=(p->>'messageId')::uuid AND lease_token=(p->>'leaseToken')::uuid FOR UPDATE;
 IF NOT FOUND OR m.status NOT IN ('dispatching','unknown','sent','delivered','read','failed') THEN RETURN jsonb_build_object('saved',false); END IF;
 IF m.provider_response IS NOT NULL THEN RETURN jsonb_build_object('saved',true,'duplicate',true); END IF;
 IF outcome<>ALL(ARRAY['accepted','retry','permanent','unknown']) THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 state:=CASE WHEN outcome='accepted' THEN 'sent' WHEN outcome='retry' AND m.attempts<3 THEN 'queued' WHEN outcome IN ('retry','permanent') THEN 'failed' ELSE 'unknown' END;
 IF state='queued' AND (EXISTS(SELECT 1 FROM outreach.workspace_suppressions WHERE workspace_id=m.workspace_id AND phone_e164=m.phone_e164) OR EXISTS(SELECT 1 FROM outreach_v2.campaigns WHERE id=m.campaign_id AND (status='stopped' OR deleted_at IS NOT NULL))) THEN state:='canceled'; END IF;
 INSERT INTO outreach_v2.message_attempts(message_id,attempt,outcome,response,error) VALUES(m.id,m.attempts,outcome,coalesce(p->'safeResponse','{}'::jsonb),left(p->>'error',1000)) ON CONFLICT DO NOTHING;
 UPDATE outreach_v2.messages SET status=state,provider_message_id=coalesce(p->>'providerMessageId',provider_message_id),provider_aliases=ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'providerAliases','[]'::jsonb))),provider_response=coalesce(p->'safeResponse','{}'::jsonb),sent_at=CASE WHEN outcome='accepted' THEN coalesce(sent_at,now()) ELSE sent_at END,lease_until=NULL,error=left(p->>'error',1000),scheduled_at=CASE WHEN state='queued' THEN now()+make_interval(secs=>greatest(CASE WHEN attempts=1 THEN 300 ELSE 900 END,least(coalesce((p->>'retryAfter')::integer,0),86400))) ELSE scheduled_at END WHERE id=m.id;
 IF outcome='accepted' AND m.sent_at IS NULL THEN
  UPDATE public.workspaces SET onboarding_step='complete',onboarding_completed_at=coalesce(onboarding_completed_at,now()) WHERE id=m.workspace_id AND onboarding_step='test' AND EXISTS(SELECT 1 FROM outreach.whatsapp_sessions WHERE id=m.whatsapp_session_id AND last_webhook_at IS NOT NULL);
  INSERT INTO outreach.usage_monthly(workspace_id,period_start,messages_sent) VALUES(m.workspace_id,date_trunc('month',now())::date,1) ON CONFLICT(workspace_id,period_start) DO UPDATE SET messages_sent=outreach.usage_monthly.messages_sent+1;
  IF m.conversation_message_id IS NULL THEN
   INSERT INTO outreach.conversations(workspace_id,whatsapp_session_id,workspace_contact_id) VALUES(m.workspace_id,m.whatsapp_session_id,m.workspace_contact_id) ON CONFLICT(workspace_id,whatsapp_session_id,workspace_contact_id) DO UPDATE SET updated_at=now() RETURNING id INTO convo;
   INSERT INTO outreach.conversation_messages(workspace_id,conversation_id,whatsapp_session_id,workspace_contact_id,direction,body,media_type,media_url,media_mime,media_filename,media_size_bytes,status,provider_message_id) VALUES(m.workspace_id,convo,m.whatsapp_session_id,m.workspace_contact_id,'outbound',m.personalized_message,m.media_type,m.media_url,m.media_mime,m.media_filename,m.media_size_bytes,'sent',p->>'providerMessageId') RETURNING id INTO outbound;
   UPDATE outreach_v2.messages SET conversation_message_id=outbound WHERE id=m.id;
   UPDATE outreach.conversations SET last_message_preview=left(m.personalized_message,200),last_message_at=now(),updated_at=now() WHERE id=convo;
  END IF;
 END IF;
 UPDATE outreach.conversation_messages SET status=CASE WHEN state IN ('sent','failed') THEN state ELSE status END,provider_message_id=coalesce(p->>'providerMessageId',provider_message_id) WHERE id=m.conversation_message_id;
 UPDATE outreach_v2.contacts SET status=CASE WHEN outcome='accepted' THEN 'sent' WHEN state='failed' THEN 'failed' ELSE status END WHERE id=m.contact_id AND status NOT IN ('opted_out','replied');
 PERFORM outreach_v2.complete_v2(m.campaign_id);
 RETURN jsonb_build_object('saved',true,'status',state);
END $$;
CREATE OR REPLACE FUNCTION outreach_v2.verify_webhook_v2(sid uuid,signature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM outreach.whatsapp_sessions s JOIN vault.decrypted_secrets v ON v.id=s.webhook_secret_id WHERE s.id=sid AND s.deleted_at IS NULL AND length(signature) BETWEEN 16 AND 2048 AND sha256(convert_to(v.decrypted_secret,'UTF8'))=sha256(convert_to(signature,'UTF8')));
$$;
CREATE OR REPLACE FUNCTION outreach_v2.process_event_v2(sid uuid,e jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s outreach.whatsapp_sessions; m outreach_v2.messages; wc outreach.workspace_contacts; conv uuid; new_state text; cid uuid;
BEGIN
 SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=sid AND deleted_at IS NULL FOR UPDATE; IF NOT FOUND THEN RETURN false; END IF;
 IF e->>'kind'='session' THEN
  new_state:=e->>'status';
  IF new_state=ANY(ARRAY['connected','connecting','disconnected','expired']) THEN UPDATE outreach.whatsapp_sessions SET status=new_state,last_seen_at=now(),updated_at=now() WHERE id=sid; END IF;
  RETURN true;
 ELSIF e->>'kind'='status' THEN
  SELECT * INTO m FROM outreach_v2.messages WHERE whatsapp_session_id=sid AND (provider_message_id=e->>'provider_message_id' OR e->>'provider_message_id'=ANY(provider_aliases)) FOR UPDATE; IF NOT FOUND THEN RETURN false; END IF;
  new_state:=e->>'status'; IF new_state<>ALL(ARRAY['sent','delivered','read','failed']) THEN RETURN true; END IF;
  UPDATE outreach_v2.messages SET status=CASE WHEN read_at IS NOT NULL THEN 'read' WHEN delivered_at IS NOT NULL AND new_state IN ('sent','failed') THEN 'delivered' ELSE new_state END,delivered_at=CASE WHEN new_state IN ('delivered','read') THEN coalesce(delivered_at,now()) ELSE delivered_at END,read_at=CASE WHEN new_state='read' THEN coalesce(read_at,now()) ELSE read_at END WHERE id=m.id;
  UPDATE outreach.conversation_messages SET status=CASE WHEN status='read' THEN 'read' WHEN status='delivered' AND new_state IN ('sent','failed') THEN 'delivered' ELSE new_state END WHERE id=m.conversation_message_id;
  PERFORM outreach_v2.complete_v2(m.campaign_id); RETURN true;
 ELSIF e->>'kind'='reply' AND coalesce(e->>'phone','') ~ '^\+[1-9][0-9]{7,14}$' THEN
  INSERT INTO outreach.workspace_contacts(workspace_id,phone_e164,name,first_name) VALUES(s.workspace_id,e->>'phone',left(coalesce(e->>'name',''),200),left(coalesce(e->>'firstName',''),200)) ON CONFLICT(workspace_id,phone_e164) DO UPDATE SET updated_at=now() RETURNING * INTO wc;
  IF coalesce((e->>'opt_out')::boolean,false) THEN
   INSERT INTO outreach.workspace_suppressions(workspace_id,phone_e164,reason) VALUES(s.workspace_id,wc.phone_e164,'WhatsApp opt-out') ON CONFLICT(workspace_id,phone_e164) DO NOTHING;
   UPDATE outreach.workspace_contacts SET status='opted_out' WHERE id=wc.id;
   UPDATE outreach_v2.messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Recipient opted out' WHERE workspace_id=s.workspace_id AND phone_e164=wc.phone_e164 AND status IN ('queued','leased');
   FOR cid IN SELECT id FROM outreach_v2.campaigns WHERE workspace_id=s.workspace_id AND status IN ('running','paused') LOOP PERFORM outreach_v2.complete_v2(cid); END LOOP;
  END IF;
  INSERT INTO outreach.conversations(workspace_id,whatsapp_session_id,workspace_contact_id,unread_count,last_message_preview,last_message_at) VALUES(s.workspace_id,sid,wc.id,1,left(e->>'text',200),coalesce((e->>'timestamp')::timestamptz,now())) ON CONFLICT(workspace_id,whatsapp_session_id,workspace_contact_id) DO UPDATE SET unread_count=outreach.conversations.unread_count+1,last_message_preview=EXCLUDED.last_message_preview,last_message_at=greatest(outreach.conversations.last_message_at,EXCLUDED.last_message_at),updated_at=now() RETURNING id INTO conv;
  INSERT INTO outreach.conversation_messages(workspace_id,conversation_id,whatsapp_session_id,workspace_contact_id,direction,body,status,provider_message_id) VALUES(s.workspace_id,conv,sid,wc.id,'inbound',left(coalesce(e->>'text',''),10000),'received',e->>'provider_message_id'); RETURN true;
 END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION outreach_v2.ingest_events_v2(sid uuid,signature text,events jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e jsonb; n integer:=0;
BEGIN
 IF NOT outreach_v2.verify_webhook_v2(sid,signature) THEN RETURN outreach_v2.result_v2('webhook',NULL,'UNAUTHORIZED','Invalid webhook signature.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('v2-api:'||(SELECT workspace_id::text FROM outreach.whatsapp_sessions WHERE id=sid),0));
 IF jsonb_typeof(events)<>'array' OR jsonb_array_length(events)>500 THEN RETURN outreach_v2.result_v2('webhook',NULL,'INVALID_REQUEST','Invalid event batch.'); END IF;
 UPDATE outreach.whatsapp_sessions SET last_webhook_at=now() WHERE id=sid;
 UPDATE public.workspaces SET onboarding_step='complete',onboarding_completed_at=coalesce(onboarding_completed_at,now()) WHERE id=(SELECT workspace_id FROM outreach.whatsapp_sessions WHERE id=sid) AND onboarding_step='test' AND EXISTS(SELECT 1 FROM outreach_v2.messages WHERE whatsapp_session_id=sid AND sent_at IS NOT NULL);
 FOR e IN SELECT value FROM jsonb_array_elements(events) LOOP
  IF length(coalesce(e->>'event_key','')) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid event key'; END IF;
  INSERT INTO outreach_v2.provider_events(whatsapp_session_id,event_key,event) VALUES(sid,e->>'event_key',e) ON CONFLICT DO NOTHING;
  IF FOUND THEN n:=n+1; IF outreach_v2.process_event_v2(sid,e) THEN UPDATE outreach_v2.provider_events SET status='processed' WHERE whatsapp_session_id=sid AND event_key=e->>'event_key'; END IF; END IF;
 END LOOP;
 RETURN outreach_v2.result_v2('webhook',jsonb_build_object('accepted',n));
END $$;
CREATE OR REPLACE FUNCTION outreach_v2.maintenance_v2() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_row record; session_row record; cid uuid; recovered integer:=0; unknowns integer:=0; changed integer;
BEGIN
 FOR session_row IN SELECT id,workspace_id FROM outreach.whatsapp_sessions WHERE deleted_at IS NULL ORDER BY id LOOP
  IF NOT pg_try_advisory_xact_lock(hashtextextended('v2-api:'||session_row.workspace_id::text,0)) THEN CONTINUE; END IF;
  PERFORM 1 FROM outreach.whatsapp_sessions WHERE id=session_row.id FOR UPDATE SKIP LOCKED; IF NOT FOUND THEN CONTINUE; END IF;
  UPDATE outreach_v2.messages SET status='queued',lease_token=NULL,lease_until=NULL WHERE whatsapp_session_id=session_row.id AND status='leased' AND lease_until<=now(); GET DIAGNOSTICS changed=ROW_COUNT; recovered:=recovered+changed;
  UPDATE outreach_v2.messages SET status='unknown',error='Outcome uncertain; review provider logs',lease_until=NULL WHERE whatsapp_session_id=session_row.id AND status='dispatching' AND lease_until<=now(); GET DIAGNOSTICS changed=ROW_COUNT; unknowns:=unknowns+changed;
  FOR event_row IN SELECT * FROM outreach_v2.provider_events WHERE whatsapp_session_id=session_row.id AND status='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
   IF outreach_v2.process_event_v2(event_row.whatsapp_session_id,event_row.event) THEN UPDATE outreach_v2.provider_events SET status='processed' WHERE whatsapp_session_id=event_row.whatsapp_session_id AND event_key=event_row.event_key;
   ELSE UPDATE outreach_v2.provider_events SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' WHERE whatsapp_session_id=event_row.whatsapp_session_id AND event_key=event_row.event_key; END IF;
  END LOOP;
  FOR cid IN SELECT id FROM outreach_v2.campaigns WHERE whatsapp_session_id=session_row.id AND status IN ('running','paused') LOOP PERFORM outreach_v2.complete_v2(cid); END LOOP;
 END LOOP;
 RETURN jsonb_build_object('recoveredLeases',recovered,'needsReview',unknowns);
END $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_claim_next_v2() RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT * FROM outreach_v2.claim_next_v2(); $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_begin_send_v2(message_id uuid,lease_token uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT outreach_v2.begin_send_v2(message_id,lease_token); $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_finish_send_v2(p jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT outreach_v2.finish_send_v2(p); $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_verify_webhook_v2(whatsapp_session_id uuid,signature text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT outreach_v2.verify_webhook_v2(whatsapp_session_id,signature); $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_ingest_events_v2(whatsapp_session_id uuid,signature text,events jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT outreach_v2.ingest_events_v2(whatsapp_session_id,signature,events); $$;
CREATE OR REPLACE FUNCTION public.eb_outreach_maintenance_v2() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT outreach_v2.maintenance_v2(); $$;
