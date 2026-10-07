-- Apply after 006 and 009. No subscriptions, customer data or schedule changes.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Validate private workspace objects before campaign/reply writes.
CREATE OR REPLACE FUNCTION outreach_v2.validate_media_v2(wid uuid,p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prefix text:='https://lreolnewuapcurpskqwr.supabase.co/storage/v1/object/authenticated/outreach-media/';
 object_path text; object_mime text; object_size bigint; max_size bigint; kind text:=p->>'mediaType';
BEGIN
 IF kind IS NULL THEN
  IF nullif(p->>'mediaUrl','') IS NOT NULL THEN RAISE EXCEPTION 'Attachment type required'; END IF;
  RETURN;
 END IF;
 IF kind NOT IN ('image','video','audio','document') OR wid IS NULL THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
 IF left(coalesce(p->>'mediaUrl',''),length(prefix))<>prefix THEN RAISE EXCEPTION 'Private workspace attachment required'; END IF;
 object_path:=substr(p->>'mediaUrl',length(prefix)+1);
 IF object_path !~ ('^'||wid::text||'/[a-zA-Z0-9._-]+$') THEN RAISE EXCEPTION 'Attachment workspace mismatch'; END IF;
 SELECT metadata->>'mimetype',(metadata->>'size')::bigint INTO object_mime,object_size
 FROM storage.objects WHERE bucket_id='outreach-media' AND name=object_path FOR SHARE;
 IF NOT FOUND OR object_size IS NULL OR object_size<=0 OR object_mime IS NULL THEN RAISE EXCEPTION 'Attachment unavailable'; END IF;
 max_size:=CASE kind WHEN 'image' THEN 5242880 WHEN 'video' THEN 52428800 WHEN 'audio' THEN 16777216 ELSE 104857600 END;
 IF object_size>max_size OR object_size IS DISTINCT FROM (p->>'mediaSizeBytes')::bigint OR object_mime IS DISTINCT FROM p->>'mediaMime' THEN RAISE EXCEPTION 'Attachment metadata mismatch'; END IF;
 IF (kind='image' AND object_mime NOT IN ('image/jpeg','image/png'))
 OR (kind='video' AND object_mime NOT IN ('video/mp4','video/3gpp'))
 OR (kind='audio' AND object_mime NOT IN ('audio/aac','audio/mpeg','audio/ogg','audio/amr'))
 OR (kind='document' AND (object_path !~* '\.(pdf|docx?|xlsx?|pptx?|txt)$' OR object_mime NOT IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'))) THEN RAISE EXCEPTION 'Unsupported attachment format'; END IF;
 IF length(coalesce(p->>'mediaFilename','')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'Attachment filename required'; END IF;
END $$;
REVOKE ALL ON FUNCTION outreach_v2.validate_media_v2(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS outreach_v2.release_function_backups (
 release_id text NOT NULL, signature text NOT NULL, definition text NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(release_id,signature));
REVOKE ALL ON outreach_v2.release_function_backups FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE outreach_v2.release_function_backups ENABLE ROW LEVEL SECURITY;
INSERT INTO outreach_v2.release_function_backups(release_id,signature,definition)
SELECT '2026-10-07-media',s,pg_get_functiondef(s::regprocedure)
FROM unnest(ARRAY['outreach_v2.api_v2(uuid,jsonb,jsonb)','outreach_v2.campaign_json_v2(outreach_v2.campaigns)','outreach_v2.finish_send_v2(jsonb)']) s
ON CONFLICT DO NOTHING;
ALTER TABLE outreach_v2.campaigns DROP CONSTRAINT IF EXISTS campaigns_template_check;
ALTER TABLE outreach_v2.campaigns ADD CONSTRAINT campaigns_template_check CHECK(length(template)<=4096 AND (length(template)>0 OR media_type IS NOT NULL));
ALTER TABLE outreach_v2.messages DROP CONSTRAINT IF EXISTS messages_personalized_message_check;
ALTER TABLE outreach_v2.messages ADD CONSTRAINT messages_personalized_message_check CHECK(length(personalized_message)<=4096 AND (length(personalized_message)>0 OR media_type IS NOT NULL));

CREATE OR REPLACE FUNCTION outreach_v2.campaign_json_v2(c outreach_v2.campaigns) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('campaignId',c.id,'workspaceId',c.workspace_id,'whatsappSessionId',c.whatsapp_session_id,'name',c.name,'template',c.template,'mediaType',c.media_type,'mediaUrl',c.media_url,'mediaMime',c.media_mime,'mediaFilename',c.media_filename,'mediaSizeBytes',c.media_size_bytes,'status',c.status,'timezone',c.timezone,'sendingStartTime',to_char(c.sending_start_time,'HH24:MI'),'sendingEndTime',to_char(c.sending_end_time,'HH24:MI'),'sendIntervalSeconds',c.send_interval_seconds,'createdAt',c.created_at,'startedAt',c.started_at,'completedAt',c.completed_at,'deletedAt',c.deleted_at);
$$;
DO $patch$
DECLARE f text; old text;
BEGIN
 f:=pg_get_functiondef('outreach_v2.api_v2(uuid,jsonb,jsonb)'::regprocedure);
 IF position('mediaType' IN f)=0 THEN
 old:=substring(f FROM $pattern$ WHEN 'create' THEN.*?(?= WHEN 'list')$pattern$);
 IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing create section'; END IF;
 f:=replace(f,old,$replacement$ WHEN 'create' THEN
  IF sid IS NULL OR s.status<>'connected' OR s.api_key_secret_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'PROVIDER_NOT_CONFIGURED','Connect a customer WASender API key first.'); END IF;
  IF length(btrim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(p->>'template','')) NOT BETWEEN 0 AND 4096 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=coalesce(p->>'timezone','')) OR (p->>'mediaType' IS NOT NULL AND p->>'mediaType' NOT IN ('image','video','audio','document')) OR (p->>'mediaType' IS NOT NULL AND coalesce(p->>'mediaUrl','') !~* '^https://') OR (p->>'mediaType' IS NULL AND length(coalesce(p->>'template',''))<1) THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Check campaign name, message, attachment and timezone.'); END IF;
  IF length(btrim(coalesce(p->>'template','')))>0 THEN PERFORM outreach.personalize(p->>'template','{}'::jsonb); END IF;
  INSERT INTO outreach_v2.campaigns(workspace_id,whatsapp_session_id,created_by,name,template,media_type,media_url,media_mime,media_filename,media_size_bytes,timezone,sending_start_time,sending_end_time,send_interval_seconds) VALUES(wid,sid,uid,btrim(p->>'name'),coalesce(p->>'template',''),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::integer,p->>'timezone',(p->>'sendingStartTime')::time,(p->>'sendingEndTime')::time,(p->>'sendIntervalSeconds')::integer) RETURNING * INTO c;
  response:=outreach_v2.campaign_json_v2(c);
$replacement$);
 old:=substring(f FROM $pattern$ WHEN 'messages' THEN.*?(?= WHEN 'stats')$pattern$);
 IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing messages section'; END IF;
 f:=replace(f,old,$replacement$ WHEN 'messages' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('messageId',q.id,'campaignId',q.campaign_id,'whatsappSessionId',q.whatsapp_session_id,'contactId',q.workspace_contact_id,'phoneE164',q.phone_e164,'personalizedMessage',q.personalized_message,'mediaType',q.media_type,'mediaUrl',q.media_url,'mediaMime',q.media_mime,'mediaFilename',q.media_filename,'status',q.status,'createdAt',q.created_at,'sentAt',q.sent_at,'error',q.error)),'[]'::jsonb) INTO response FROM (SELECT * FROM outreach_v2.messages WHERE workspace_id=wid AND (cid IS NULL OR campaign_id=cid) AND (campaign_id IS NULL OR EXISTS(SELECT 1 FROM outreach_v2.campaigns ca WHERE ca.id=campaign_id AND ca.deleted_at IS NULL)) ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
$replacement$);
 old:=substring(f FROM $pattern$ WHEN 'conversation' THEN.*?(?= WHEN 'reply')$pattern$);
 IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing conversation section'; END IF;
 f:=replace(f,old,$replacement$ WHEN 'conversation' THEN
  IF conv_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a conversation.'); END IF;
  SELECT jsonb_build_object('conversationId',conv.id,'whatsappSessionId',conv.whatsapp_session_id,'contact',outreach_v2.contact_json_v2(wc2),'messages',coalesce((SELECT jsonb_agg(jsonb_build_object('messageId',q.id,'direction',q.direction,'body',q.body,'mediaType',q.media_type,'mediaUrl',q.media_url,'mediaMime',q.media_mime,'mediaFilename',q.media_filename,'status',q.status,'createdAt',q.created_at) ORDER BY q.created_at,q.id) FROM (SELECT * FROM outreach.conversation_messages WHERE conversation_id=conv_id AND workspace_id=wid ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q),'[]'::jsonb)) INTO response FROM outreach.workspace_contacts wc2 WHERE wc2.id=conv.workspace_contact_id AND wc2.workspace_id=wid;
$replacement$);
 old:=substring(f FROM $pattern$ WHEN 'reply' THEN.*?(?= WHEN 'markConversationRead')$pattern$);
 IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing reply section'; END IF;
 f:=replace(f,old,$replacement$ WHEN 'reply' THEN
  IF conv_id IS NULL OR length(btrim(coalesce(p->>'text',''))) NOT BETWEEN 0 AND 4096 OR (length(btrim(coalesce(p->>'text','')))=0 AND p->>'mediaType' IS NULL) OR (p->>'mediaType' IS NOT NULL AND p->>'mediaType' NOT IN ('image','video','audio','document')) OR (p->>'mediaType' IS NOT NULL AND coalesce(p->>'mediaUrl','') !~* '^https://') THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter a reply or attach a valid media file.'); END IF;
  SELECT * INTO wc FROM outreach.workspace_contacts WHERE id=conv.workspace_contact_id AND workspace_id=wid;
  SELECT * INTO s FROM outreach.whatsapp_sessions WHERE id=conv.whatsapp_session_id AND workspace_id=wid AND deleted_at IS NULL;
  IF s.status<>'connected' OR s.api_key_secret_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'PROVIDER_NOT_CONNECTED','The conversation WhatsApp connection is not ready.'); END IF;
  IF EXISTS(SELECT 1 FROM outreach.workspace_suppressions WHERE workspace_id=wid AND phone_e164=wc.phone_e164) THEN RETURN outreach_v2.result_v2(rid,NULL,'RECIPIENT_SUPPRESSED','This contact has opted out.'); END IF;
  INSERT INTO outreach.conversation_messages(workspace_id,conversation_id,whatsapp_session_id,workspace_contact_id,direction,body,media_type,media_url,media_mime,media_filename,media_size_bytes,status) VALUES(wid,conv_id,conv.whatsapp_session_id,wc.id,'outbound',btrim(p->>'text'),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::integer,'queued') RETURNING id INTO inserted_id;
  INSERT INTO outreach_v2.messages(workspace_id,whatsapp_session_id,workspace_contact_id,conversation_message_id,phone_e164,personalized_message,media_type,media_url,media_mime,media_filename,media_size_bytes) VALUES(wid,conv.whatsapp_session_id,wc.id,inserted_id,wc.phone_e164,btrim(p->>'text'),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::integer);
  UPDATE outreach.conversations SET last_message_preview=left(btrim(p->>'text'),200),last_message_at=now(),updated_at=now() WHERE id=conv_id;
  response:=jsonb_build_object('messageId',inserted_id,'conversationId',conv_id,'status','queued');
$replacement$);
 old:=substring(f FROM $pattern$INSERT INTO outreach_v2.messages\(workspace_id,whatsapp_session_id,campaign_id,.*?ON CONFLICT\(contact_id\) DO NOTHING;$pattern$);
 IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing queue insert'; END IF;
 f:=replace(f,old,$replacement$INSERT INTO outreach_v2.messages(workspace_id,whatsapp_session_id,campaign_id,contact_id,workspace_contact_id,phone_e164,personalized_message,media_type,media_url,media_mime,media_filename,media_size_bytes)
   SELECT wid,c.whatsapp_session_id,cid,ct.id,wc2.id,wc2.phone_e164,CASE WHEN length(btrim(c.template))=0 AND c.media_type IS NOT NULL THEN '' ELSE outreach.personalize(c.template,to_jsonb(wc2)||jsonb_build_object('phone',wc2.phone_e164)) END,c.media_type,c.media_url,c.media_mime,c.media_filename,c.media_size_bytes FROM outreach_v2.contacts ct JOIN outreach.workspace_contacts wc2 ON wc2.id=ct.workspace_contact_id AND wc2.workspace_id=wid WHERE ct.campaign_id=cid AND ct.status='valid' AND NOT EXISTS(SELECT 1 FROM outreach.workspace_suppressions su WHERE su.workspace_id=wid AND su.phone_e164=wc2.phone_e164) ON CONFLICT(contact_id) DO NOTHING;$replacement$);
 END IF;
 IF position('validate_media_v2' IN f)=0 THEN
 IF position('CASE a' IN f)=0 THEN RAISE EXCEPTION 'Media migration stopped: action dispatch missing'; END IF;
 f:=replace(f,'CASE a',$replacement$IF a IN ('create','reply') THEN PERFORM outreach_v2.validate_media_v2(wid,p); END IF; CASE a$replacement$);
 END IF; EXECUTE f;
 f:=pg_get_functiondef('outreach_v2.finish_send_v2(jsonb)'::regprocedure);
 IF position('m.media_type' IN f)=0 THEN
 old:=substring(f FROM $pattern$INSERT INTO outreach.conversation_messages\(workspace_id,conversation_id,.*?RETURNING id INTO outbound;$pattern$);
 IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: conversation insert missing'; END IF;
 f:=replace(f,old,$replacement$INSERT INTO outreach.conversation_messages(workspace_id,conversation_id,whatsapp_session_id,workspace_contact_id,direction,body,media_type,media_url,media_mime,media_filename,media_size_bytes,status,provider_message_id) VALUES(m.workspace_id,convo,m.whatsapp_session_id,m.workspace_contact_id,'outbound',m.personalized_message,m.media_type,m.media_url,m.media_mime,m.media_filename,m.media_size_bytes,'sent',p->>'providerMessageId') RETURNING id INTO outbound;$replacement$); EXECUTE f; END IF;
END $patch$;
COMMIT;
