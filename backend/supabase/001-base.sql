-- EightBit WhatsApp Outreach v1. Supabase SQL Editor, run as project database owner.
-- Dedicated, non-public schema. Never add outreach to Supabase exposed schemas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS outreach;
REVOKE ALL ON SCHEMA outreach FROM PUBLIC;
CREATE TABLE IF NOT EXISTS outreach.campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','paused','stopped','completed')),
 template text NOT NULL CHECK(length(template) BETWEEN 1 AND 4096),
 send_interval_seconds integer NOT NULL DEFAULT 120 CHECK(send_interval_seconds BETWEEN 15 AND 86400),
 sending_start_time time NOT NULL DEFAULT '09:00', sending_end_time time NOT NULL DEFAULT '18:00',
 timezone text NOT NULL DEFAULT 'UTC', next_send_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS outreach.contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES outreach.campaigns(id),
 name text NOT NULL DEFAULT '', first_name text NOT NULL DEFAULT '', company text NOT NULL DEFAULT '',
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'), email text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '', industry text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','queued','sent','replied','opted_out','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,phone)
);
CREATE TABLE IF NOT EXISTS outreach.messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES outreach.campaigns(id),
 contact_id uuid NOT NULL UNIQUE REFERENCES outreach.contacts(id), phone text NOT NULL,
 personalized_message text NOT NULL, provider_message_id text UNIQUE, provider_aliases text[] NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','dispatching','sent','delivered','read','failed','canceled','unknown')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3), scheduled_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, lease_until timestamptz, dispatch_started_at timestamptz,
 sent_at timestamptz, delivered_at timestamptz, read_at timestamptz, replied_at timestamptz,
 error text, provider_response jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_due ON outreach.messages(campaign_id,scheduled_at) WHERE status='queued';
CREATE INDEX IF NOT EXISTS messages_phone ON outreach.messages(phone);
CREATE INDEX IF NOT EXISTS messages_aliases ON outreach.messages USING gin(provider_aliases);
CREATE TABLE IF NOT EXISTS outreach.message_attempts (
 message_id uuid NOT NULL REFERENCES outreach.messages(id), attempt integer NOT NULL,
 outcome text NOT NULL, response jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(message_id,attempt)
);
CREATE TABLE IF NOT EXISTS outreach.suppression_list (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone text NOT NULL UNIQUE CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'),
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outreach.replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_message_id text NOT NULL UNIQUE,
 contact_id uuid REFERENCES outreach.contacts(id), campaign_id uuid REFERENCES outreach.campaigns(id),
 phone text NOT NULL, message text NOT NULL, received_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outreach.webhook_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_key text NOT NULL UNIQUE,
 event jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','unmatched','ignored')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, error text
);
CREATE INDEX IF NOT EXISTS events_pending ON outreach.webhook_events(next_attempt_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS outreach.api_requests (
 request_key text PRIMARY KEY, request_body jsonb NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outreach.templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outreach.sender_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 min_interval_seconds integer NOT NULL DEFAULT 15 CHECK(min_interval_seconds BETWEEN 15 AND 86400),
 next_send_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO outreach.sender_settings(id) VALUES(true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION outreach.in_window(c outreach.campaigns, at_time timestamptz DEFAULT now()) RETURNS boolean
LANGUAGE sql STABLE SET search_path=outreach,pg_temp AS $$
 SELECT CASE WHEN c.sending_start_time=c.sending_end_time THEN true
 WHEN c.sending_start_time<c.sending_end_time THEN (at_time AT TIME ZONE c.timezone)::time >= c.sending_start_time AND (at_time AT TIME ZONE c.timezone)::time < c.sending_end_time
 ELSE (at_time AT TIME ZONE c.timezone)::time >= c.sending_start_time OR (at_time AT TIME ZONE c.timezone)::time < c.sending_end_time END;
$$;
CREATE OR REPLACE FUNCTION outreach.personalize(t text, c jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text; result text:=t;
BEGIN
 FOREACH k IN ARRAY ARRAY['name','first_name','company','phone','email','city','industry'] LOOP
  result:=replace(result,'{{'||k||'}}',coalesce(c->>k,''));
 END LOOP;
 IF result ~ '\{\{|\}\}' OR length(result)>4096 OR length(btrim(result))=0 THEN RAISE EXCEPTION 'Invalid template'; END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION outreach.stats(cid uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SET search_path=outreach,pg_temp AS $$
 SELECT jsonb_build_object(
 'total_contacts',(SELECT count(*) FROM contacts WHERE cid IS NULL OR campaign_id=cid),
 'opted_out',(SELECT count(*) FROM contacts WHERE (cid IS NULL OR campaign_id=cid) AND status='opted_out'),
 'queued',count(*) FILTER(WHERE status IN ('queued','leased')),
 'sending',count(*) FILTER(WHERE status='dispatching'), 'sent',count(*) FILTER(WHERE sent_at IS NOT NULL),
 'delivered',count(*) FILTER(WHERE delivered_at IS NOT NULL), 'read',count(*) FILTER(WHERE read_at IS NOT NULL),
 'replied',count(*) FILTER(WHERE replied_at IS NOT NULL), 'failed',count(*) FILTER(WHERE status='failed'),
 'canceled',count(*) FILTER(WHERE status='canceled'), 'needs_review',count(*) FILTER(WHERE status='unknown'))
 FROM messages WHERE cid IS NULL OR campaign_id=cid;
$$;
CREATE OR REPLACE FUNCTION outreach.suppress(p text, why text) RETURNS void LANGUAGE plpgsql SET search_path=outreach,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 INSERT INTO suppression_list(phone,reason) VALUES(p,left(why,500)) ON CONFLICT(phone) DO NOTHING;
 UPDATE contacts SET status='opted_out' WHERE phone=p;
 UPDATE messages SET status='canceled',error='Recipient suppressed',lease_token=NULL,lease_until=NULL WHERE phone=p AND status IN ('queued','leased');
END $$;

CREATE OR REPLACE FUNCTION outreach.api(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE a text:=p->>'action'; cid uuid; c campaigns; r jsonb; old api_requests; row_data jsonb; ct contacts;
 inserted_count integer:=0; duplicate_count integer:=0; suppressed_count integer:=0; limit_n integer; offset_n integer; key_text text:=p->>'requestId';
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 IF a IS NULL THEN RETURN jsonb_build_object('success',false,'httpStatus',400,'error','Missing action'); END IF;
 IF a NOT IN ('list','detail','stats','replies','messages','templates','health') THEN
  IF key_text IS NULL OR length(key_text) NOT BETWEEN 8 AND 128 THEN RETURN jsonb_build_object('success',false,'httpStatus',400,'error','requestId must be 8-128 characters'); END IF;
  SELECT * INTO old FROM api_requests WHERE request_key=key_text;
  IF FOUND THEN
   IF old.request_body<>p THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','requestId already used for another request'); END IF;
   RETURN old.response;
  END IF;
 END IF;
 limit_n:=greatest(1,least(200,coalesce((p->>'limit')::integer,50))); offset_n:=greatest(0,coalesce((p->>'offset')::integer,0));
 IF p ? 'campaignId' THEN cid:=(p->>'campaignId')::uuid; END IF;
 IF a IN ('detail','import','start','pause','resume','stop','messages') AND cid IS NULL THEN RAISE EXCEPTION 'campaignId required'; END IF;
 IF cid IS NOT NULL THEN SELECT * INTO c FROM campaigns WHERE id=cid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'httpStatus',404,'error','Campaign not found'); END IF;
 END IF;
 CASE a
 WHEN 'health' THEN r:=jsonb_build_object('success',true,'schemaVersion',1,'senderEnabled',(SELECT enabled FROM sender_settings WHERE id));
 WHEN 'create' THEN
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=coalesce(p->>'timezone','UTC')) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
  PERFORM personalize(p->>'template','{}'::jsonb);
  INSERT INTO campaigns(name,template,send_interval_seconds,sending_start_time,sending_end_time,timezone)
  VALUES(p->>'name',p->>'template',coalesce((p->>'sendIntervalSeconds')::integer,120),coalesce((p->>'sendingStartTime')::time,'09:00'),coalesce((p->>'sendingEndTime')::time,'18:00'),coalesce(p->>'timezone','UTC')) RETURNING * INTO c;
  r:=jsonb_build_object('success',true,'campaignId',c.id,'status',c.status);
 WHEN 'list' THEN SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),'limit',limit_n,'offset',offset_n) INTO r FROM (SELECT * FROM campaigns ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'detail' THEN r:=jsonb_build_object('success',true,'data',to_jsonb(c),'statistics',stats(cid));
 WHEN 'stats' THEN r:=jsonb_build_object('success',true,'data',stats(cid));
 WHEN 'templates' THEN SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM (SELECT * FROM templates ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'saveTemplate' THEN
  PERFORM personalize(p->>'template','{}'::jsonb);
  INSERT INTO templates(name,body) VALUES(p->>'name',p->>'template') ON CONFLICT(name) DO UPDATE SET body=excluded.body RETURNING jsonb_build_object('success',true,'templateId',id) INTO r;
 WHEN 'import' THEN
  IF c.status<>'draft' THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','Contacts can only be imported into draft campaigns'); END IF;
  IF jsonb_typeof(p->'contacts')<>'array' OR jsonb_array_length(p->'contacts')>5000 THEN RAISE EXCEPTION 'Invalid contacts batch'; END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p->'contacts') LOOP
   IF EXISTS(SELECT 1 FROM suppression_list WHERE phone=row_data->>'phone') THEN suppressed_count:=suppressed_count+1; CONTINUE; END IF;
   INSERT INTO contacts(campaign_id,name,first_name,company,phone,email,city,industry)
   VALUES(cid,coalesce(row_data->>'name',''),coalesce(row_data->>'first_name',''),coalesce(row_data->>'company',''),row_data->>'phone',coalesce(row_data->>'email',''),coalesce(row_data->>'city',''),coalesce(row_data->>'industry','')) ON CONFLICT(campaign_id,phone) DO NOTHING;
   IF FOUND THEN inserted_count:=inserted_count+1; ELSE duplicate_count:=duplicate_count+1; END IF;
  END LOOP;
  r:=jsonb_build_object('success',true,'campaignId',cid,'imported',inserted_count,'duplicates',duplicate_count,'suppressed',suppressed_count,'validation',coalesce(p->'validation','{}'::jsonb));
 WHEN 'start' THEN
  IF c.status<>'draft' THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','Only draft campaigns can start'); END IF;
  IF NOT EXISTS(SELECT 1 FROM contacts WHERE campaign_id=cid AND status='valid' AND phone NOT IN(SELECT phone FROM suppression_list)) THEN RAISE EXCEPTION 'No eligible contacts'; END IF;
  INSERT INTO messages(campaign_id,contact_id,phone,personalized_message)
  SELECT cid,t.id,t.phone,personalize(c.template,to_jsonb(t)) FROM contacts t WHERE t.campaign_id=cid AND t.status='valid' AND NOT EXISTS(SELECT 1 FROM suppression_list s WHERE s.phone=t.phone) ON CONFLICT(contact_id) DO NOTHING;
  UPDATE contacts SET status='queued' WHERE campaign_id=cid AND status='valid' AND id IN(SELECT contact_id FROM messages WHERE campaign_id=cid);
  UPDATE campaigns SET status='running',started_at=now(),next_send_at=now() WHERE id=cid;
  r:=jsonb_build_object('success',true,'campaignId',cid,'status','running');
 WHEN 'pause' THEN
  IF c.status NOT IN ('running','paused') THEN RAISE EXCEPTION 'Campaign cannot be paused'; END IF;
  UPDATE campaigns SET status='paused' WHERE id=cid;
  UPDATE messages SET status='queued',lease_token=NULL,lease_until=NULL WHERE campaign_id=cid AND status='leased';
  r:=jsonb_build_object('success',true,'campaignId',cid,'status','paused');
 WHEN 'resume' THEN
  IF c.status<>'paused' THEN RAISE EXCEPTION 'Only paused campaigns can resume'; END IF;
  UPDATE campaigns SET status='running' WHERE id=cid;
  r:=jsonb_build_object('success',true,'campaignId',cid,'status','running');
 WHEN 'stop' THEN
  IF c.status='completed' THEN RAISE EXCEPTION 'Completed campaign cannot be stopped'; END IF;
  UPDATE campaigns SET status='stopped' WHERE id=cid;
  UPDATE messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Campaign stopped' WHERE campaign_id=cid AND status IN ('queued','leased');
  r:=jsonb_build_object('success',true,'campaignId',cid,'status','stopped');
 WHEN 'replies' THEN SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM (SELECT * FROM replies WHERE cid IS NULL OR campaign_id=cid ORDER BY received_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'messages' THEN SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM (SELECT id,contact_id,phone,personalized_message,provider_message_id,status,attempts,scheduled_at,sent_at,delivered_at,read_at,replied_at,error FROM messages WHERE campaign_id=cid ORDER BY created_at,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'suppress' THEN PERFORM suppress(p->>'phone',coalesce(p->>'reason','Manual opt-out')); r:=jsonb_build_object('success',true,'status','suppressed');
 ELSE RETURN jsonb_build_object('success',false,'httpStatus',400,'error','Unsupported action');
 END CASE;
 IF a NOT IN ('list','detail','stats','replies','messages','templates','health') THEN INSERT INTO api_requests(request_key,request_body,response) VALUES(key_text,p,r); END IF;
 RETURN r;
EXCEPTION WHEN invalid_text_representation OR check_violation OR not_null_violation OR invalid_datetime_format OR datetime_field_overflow OR raise_exception THEN
 RETURN jsonb_build_object('success',false,'httpStatus',400,'error','Invalid input or campaign state');
END $$;

CREATE OR REPLACE FUNCTION outreach.claim_next() RETURNS SETOF outreach.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE chosen messages; cfg sender_settings;
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 SELECT * INTO cfg FROM sender_settings WHERE id FOR UPDATE;
 IF NOT cfg.enabled OR cfg.next_send_at>now() OR EXISTS(SELECT 1 FROM messages WHERE status IN ('leased','dispatching')) THEN RETURN; END IF;
 SELECT m.* INTO chosen FROM messages m JOIN campaigns c ON c.id=m.campaign_id
 WHERE c.status='running' AND c.next_send_at<=now() AND in_window(c) AND m.status='queued' AND m.scheduled_at<=now() AND m.attempts<3
 AND NOT EXISTS(SELECT 1 FROM suppression_list s WHERE s.phone=m.phone)
 ORDER BY c.next_send_at,m.scheduled_at,m.id LIMIT 1 FOR UPDATE OF m SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY UPDATE messages SET status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' WHERE id=chosen.id RETURNING *;
END $$;
CREATE OR REPLACE FUNCTION outreach.begin_send(mid uuid, token uuid) RETURNS SETOF outreach.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE m messages; c campaigns; cfg sender_settings;
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 SELECT * INTO m FROM messages WHERE id=mid AND lease_token=token AND status='leased' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO c FROM campaigns WHERE id=m.campaign_id; SELECT * INTO cfg FROM sender_settings WHERE id;
 IF EXISTS(SELECT 1 FROM suppression_list WHERE phone=m.phone) THEN UPDATE messages SET status='canceled',error='Recipient suppressed',lease_token=NULL,lease_until=NULL WHERE id=mid; RETURN; END IF;
 IF c.status<>'running' OR NOT cfg.enabled OR NOT in_window(c) OR c.next_send_at>now() OR cfg.next_send_at>now() THEN
  UPDATE messages SET status=CASE WHEN c.status='stopped' THEN 'canceled' ELSE 'queued' END,lease_token=NULL,lease_until=NULL WHERE id=mid; RETURN;
 END IF;
 UPDATE campaigns SET next_send_at=now()+make_interval(secs=>c.send_interval_seconds) WHERE id=c.id;
 UPDATE sender_settings SET next_send_at=now()+make_interval(secs=>min_interval_seconds) WHERE id;
 RETURN QUERY UPDATE messages SET status='dispatching',attempts=attempts+1,provider_response=NULL,dispatch_started_at=now(),lease_until=now()+interval '5 minutes' WHERE id=mid RETURNING *;
END $$;
CREATE OR REPLACE FUNCTION outreach.finish_send(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE m messages; outcome text:=p->>'outcome'; new_status text;
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 SELECT * INTO m FROM messages WHERE id=(p->>'id')::uuid AND lease_token=(p->>'lease_token')::uuid FOR UPDATE;
 IF NOT FOUND OR m.status NOT IN ('dispatching','unknown','sent','delivered','read','failed') THEN RETURN jsonb_build_object('saved',false); END IF;
 IF m.provider_response IS NOT NULL THEN RETURN jsonb_build_object('saved',true,'duplicate',true); END IF;
 INSERT INTO message_attempts(message_id,attempt,outcome,response,error) VALUES(m.id,m.attempts,outcome,p->'provider_response',left(p->>'error',1000)) ON CONFLICT DO NOTHING;
 new_status:=CASE WHEN outcome='accepted' THEN 'sent' WHEN outcome='retry' AND m.attempts<3 THEN 'queued' WHEN outcome='permanent' OR outcome='retry' THEN 'failed' ELSE 'unknown' END;
 IF m.delivered_at IS NOT NULL OR m.read_at IS NOT NULL THEN new_status:=m.status; END IF;
 IF new_status='queued' AND EXISTS(SELECT 1 FROM suppression_list WHERE phone=m.phone) THEN new_status:='canceled'; END IF;
 IF new_status='queued' AND EXISTS(SELECT 1 FROM campaigns WHERE id=m.campaign_id AND status='stopped') THEN new_status:='canceled'; END IF;
 UPDATE messages SET status=new_status,provider_message_id=coalesce(p->>'provider_message_id',provider_message_id),
 provider_aliases=coalesce(ARRAY(SELECT jsonb_array_elements_text(p->'provider_aliases')),provider_aliases),provider_response=p->'provider_response',
 sent_at=CASE WHEN outcome='accepted' THEN coalesce(sent_at,now()) ELSE sent_at END,
 scheduled_at=CASE WHEN new_status='queued' THEN now()+make_interval(secs=>greatest(CASE WHEN attempts=1 THEN 300 ELSE 900 END,least(coalesce((p->>'retry_after')::integer,0),86400))) ELSE scheduled_at END,
 lease_until=NULL, error=left(p->>'error',1000) WHERE id=m.id;
 -- Each attempt has its own response; reset it only when the NEXT lease is dispatched.
 UPDATE campaigns SET next_send_at=greatest(next_send_at,now()+make_interval(secs=>send_interval_seconds)) WHERE id=m.campaign_id;
 UPDATE sender_settings SET next_send_at=greatest(next_send_at,now()+make_interval(secs=>min_interval_seconds)) WHERE id;
 UPDATE contacts SET status=CASE WHEN new_status='failed' THEN 'failed' WHEN outcome='accepted' THEN 'sent' ELSE status END WHERE id=m.contact_id AND status NOT IN ('opted_out','replied');
 RETURN jsonb_build_object('saved',true,'status',new_status);
END $$;

CREATE OR REPLACE FUNCTION outreach.ingest_events(events jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE e jsonb; inserted_count integer:=0; optout_count integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 IF jsonb_typeof(events)<>'array' OR jsonb_array_length(events)>500 THEN RAISE EXCEPTION 'Invalid event batch'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(events) LOOP
  INSERT INTO webhook_events(event_key,event) VALUES(e->>'event_key',e) ON CONFLICT(event_key) DO NOTHING;
  IF FOUND THEN inserted_count:=inserted_count+1; END IF;
  -- Suppression is immediate at receipt, before acknowledging the provider.
  IF e->>'kind'='reply' AND coalesce((e->>'opt_out')::boolean,false) AND e->>'phone' IS NOT NULL THEN
   PERFORM suppress(e->>'phone','WhatsApp opt-out'); optout_count:=optout_count+1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('success',true,'received',inserted_count,'optOuts',optout_count);
END $$;
CREATE OR REPLACE FUNCTION outreach.process_events() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE ev webhook_events; e jsonb; m messages; ct contacts; at_time timestamptz; s text; n integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 FOR ev IN SELECT * FROM webhook_events WHERE status='pending' AND next_attempt_at<=now() ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  e:=ev.event; m:=NULL; ct:=NULL; at_time:=coalesce((e->>'timestamp')::timestamptz,ev.received_at);
  IF e->>'kind'='status' THEN
   SELECT * INTO m FROM messages WHERE provider_message_id=e->>'provider_message_id' OR provider_aliases @> ARRAY[e->>'provider_message_id'] ORDER BY created_at DESC LIMIT 1;
   IF m.id IS NULL THEN
    UPDATE webhook_events SET attempts=attempts+1,next_attempt_at=now()+interval '1 minute',status=CASE WHEN received_at<now()-interval '24 hours' THEN 'unmatched' ELSE 'pending' END,error='Provider message ID not matched; retained for reconciliation' WHERE id=ev.id; CONTINUE;
   END IF;
   s:=e->>'status';
   UPDATE messages SET sent_at=CASE WHEN s IN ('sent','delivered','read') THEN coalesce(sent_at,at_time) ELSE sent_at END,
    delivered_at=CASE WHEN s IN ('delivered','read') THEN coalesce(delivered_at,at_time) ELSE delivered_at END,
    read_at=CASE WHEN s='read' THEN coalesce(read_at,at_time) ELSE read_at END,
    status=CASE WHEN read_at IS NOT NULL OR s='read' THEN 'read' WHEN delivered_at IS NOT NULL OR s='delivered' THEN 'delivered' WHEN s='sent' AND status<>'failed' THEN 'sent' WHEN s='failed' THEN 'failed' ELSE status END,
    error=CASE WHEN s='failed' THEN 'Provider reported delivery failure; review before any resend' ELSE error END WHERE id=m.id;
  ELSIF e->>'kind'='reply' AND e->>'phone' IS NOT NULL THEN
   -- Attribute to the most recent send before the reply; never attach one reply to every campaign.
   SELECT * INTO m FROM messages WHERE phone=e->>'phone' AND dispatch_started_at<=at_time ORDER BY dispatch_started_at DESC LIMIT 1;
   IF m.id IS NOT NULL THEN SELECT * INTO ct FROM contacts WHERE id=m.contact_id; END IF;
   INSERT INTO replies(provider_message_id,contact_id,campaign_id,phone,message,received_at)
   VALUES(e->>'provider_message_id',ct.id,ct.campaign_id,e->>'phone',coalesce(e->>'text',''),at_time) ON CONFLICT(provider_message_id) DO NOTHING;
   IF m.id IS NOT NULL THEN UPDATE messages SET replied_at=coalesce(replied_at,at_time) WHERE id=m.id; END IF;
   IF ct.id IS NOT NULL THEN UPDATE contacts SET status='replied' WHERE id=ct.id AND status<>'opted_out'; END IF;
  ELSE
   UPDATE webhook_events SET status='ignored',processed_at=now(),error=coalesce(e->>'reason','Unsupported event') WHERE id=ev.id; CONTINUE;
  END IF;
  UPDATE webhook_events SET status='processed',processed_at=now(),error=NULL WHERE id=ev.id; n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('processed',n);
END $$;
CREATE OR REPLACE FUNCTION outreach.maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE recovered integer; ambiguous integer; completed integer;
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 UPDATE messages SET status='queued',lease_token=NULL,lease_until=NULL WHERE status='leased' AND lease_until<now(); GET DIAGNOSTICS recovered=ROW_COUNT;
 UPDATE messages SET status='unknown',error='Execution interrupted during dispatch; reconcile provider logs before resending',lease_until=NULL WHERE status='dispatching' AND lease_until<now(); GET DIAGNOSTICS ambiguous=ROW_COUNT;
 UPDATE messages m SET status='canceled',lease_token=NULL,lease_until=NULL,error='Suppressed or stopped' WHERE m.status IN ('queued','leased') AND (EXISTS(SELECT 1 FROM suppression_list s WHERE s.phone=m.phone) OR EXISTS(SELECT 1 FROM campaigns c WHERE c.id=m.campaign_id AND c.status='stopped'));
 UPDATE campaigns c SET status='completed',completed_at=now() WHERE c.status='running' AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.campaign_id=c.id AND m.status IN ('queued','leased','dispatching','unknown'));
 GET DIAGNOSTICS completed=ROW_COUNT;
 RETURN jsonb_build_object('recoveredLeases',recovered,'needsReview',ambiguous,'completed',completed);
END $$;

-- Defense in depth: private schema + RLS with no browser policies.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='outreach' LOOP
  EXECUTE format('ALTER TABLE outreach.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA outreach FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA outreach FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA outreach FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA outreach REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;

-- Run after schema.sql in the Supabase SQL Editor as project owner.
-- Public API wrappers only; outreach tables remain in a private schema.
BEGIN;
CREATE OR REPLACE FUNCTION public.eb_outreach_api(p jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('result',outreach.api(p));
$$;
CREATE OR REPLACE FUNCTION public.eb_outreach_claim_next() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) FROM outreach.claim_next() m;
$$;
CREATE OR REPLACE FUNCTION public.eb_outreach_begin_send(mid uuid, token uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) FROM outreach.begin_send(mid,token) m;
$$;
CREATE OR REPLACE FUNCTION public.eb_outreach_finish_send(p jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('result',outreach.finish_send(p));
$$;
CREATE OR REPLACE FUNCTION public.eb_outreach_ingest_events(events jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('result',outreach.ingest_events(events));
$$;
CREATE OR REPLACE FUNCTION public.eb_outreach_process_events() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('result',outreach.process_events());
$$;
CREATE OR REPLACE FUNCTION public.eb_outreach_maintenance() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('result',outreach.maintenance());
$$;
REVOKE ALL ON FUNCTION public.eb_outreach_api(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eb_outreach_claim_next() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eb_outreach_begin_send(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eb_outreach_finish_send(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eb_outreach_ingest_events(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eb_outreach_process_events() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eb_outreach_maintenance() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eb_outreach_api(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.eb_outreach_claim_next() TO service_role;
GRANT EXECUTE ON FUNCTION public.eb_outreach_begin_send(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eb_outreach_finish_send(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.eb_outreach_ingest_events(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.eb_outreach_process_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.eb_outreach_maintenance() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
