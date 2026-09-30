-- Extend the existing outreach schema; do not run the original installer over a live schema.
-- Run as the Supabase database owner. Archive deletion retains related records for audit.
BEGIN;
ALTER TABLE outreach.campaigns ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
DO $copy$ BEGIN
 IF to_regprocedure('outreach.api_v1_preserved(jsonb)') IS NULL THEN
  EXECUTE replace(pg_get_functiondef('outreach.api(jsonb)'::regprocedure),'FUNCTION outreach.api(', 'FUNCTION outreach.api_v1_preserved(');
 END IF;
 IF to_regprocedure('outreach.stats_v1_preserved(uuid)') IS NULL THEN
  EXECUTE replace(pg_get_functiondef('outreach.stats(uuid)'::regprocedure),'FUNCTION outreach.stats(', 'FUNCTION outreach.stats_v1_preserved(');
 END IF;
END $copy$;
CREATE OR REPLACE FUNCTION outreach.stats(cid uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SET search_path=outreach,pg_temp AS $$
 SELECT jsonb_build_object(
 'total_campaigns',(SELECT count(*) FROM campaigns WHERE deleted_at IS NULL),
 'active_campaigns',(SELECT count(*) FROM campaigns WHERE deleted_at IS NULL AND status='running'),
 'total_contacts',(SELECT count(*) FROM contacts t JOIN campaigns c ON c.id=t.campaign_id WHERE c.deleted_at IS NULL AND (cid IS NULL OR c.id=cid)),
 'opted_out',(SELECT count(*) FROM contacts t JOIN campaigns c ON c.id=t.campaign_id WHERE c.deleted_at IS NULL AND (cid IS NULL OR c.id=cid) AND t.status='opted_out'),
 'queued',count(*) FILTER(WHERE m.status IN ('queued','leased')),
 'sending',count(*) FILTER(WHERE m.status='dispatching'),'sent',count(*) FILTER(WHERE m.sent_at IS NOT NULL),
 'delivered',count(*) FILTER(WHERE m.delivered_at IS NOT NULL),'read',count(*) FILTER(WHERE m.read_at IS NOT NULL),
 'replied',count(*) FILTER(WHERE m.replied_at IS NOT NULL),'failed',count(*) FILTER(WHERE m.status='failed'),
 'canceled',count(*) FILTER(WHERE m.status='canceled'),'needs_review',count(*) FILTER(WHERE m.status='unknown'))
 FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE c.deleted_at IS NULL AND (cid IS NULL OR c.id=cid);
$$;
CREATE OR REPLACE FUNCTION outreach.api(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE a text:=p->>'action'; cid uuid; stored_campaign campaigns; r jsonb; old api_requests; request_key_text text:=p->>'requestId';
 limit_n integer:=greatest(1,least(200,coalesce((p->>'limit')::integer,50))); offset_n integer:=greatest(0,coalesce((p->>'offset')::integer,0));
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 IF p ? 'campaignId' THEN cid:=(p->>'campaignId')::uuid; END IF;
 IF a IN ('delete','deleteTemplate') THEN
  IF request_key_text IS NULL OR length(request_key_text) NOT BETWEEN 8 AND 128 THEN RETURN jsonb_build_object('success',false,'httpStatus',400,'error','requestId must be 8-128 characters'); END IF;
  SELECT * INTO old FROM api_requests WHERE request_key=request_key_text;
  IF FOUND THEN
   IF old.request_body<>p THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','requestId already used for another request'); END IF;
   RETURN old.response;
  END IF;
 END IF;
 IF cid IS NOT NULL THEN
  SELECT * INTO stored_campaign FROM campaigns WHERE id=cid FOR UPDATE;
  IF NOT FOUND OR stored_campaign.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('success',false,'httpStatus',404,'error','Campaign not found'); END IF;
 END IF;
 CASE a
 WHEN 'delete' THEN
  IF cid IS NULL THEN RETURN jsonb_build_object('success',false,'httpStatus',400,'error','campaignId required'); END IF;
  IF stored_campaign.status NOT IN ('draft','paused','stopped','completed') THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','Pause or stop the campaign before deletion'); END IF;
  IF EXISTS(SELECT 1 FROM messages WHERE campaign_id=cid AND status IN ('dispatching','unknown')) THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','A message outcome is unresolved; resolve it before deleting this campaign'); END IF;
  UPDATE messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Campaign deleted' WHERE campaign_id=cid AND status IN ('queued','leased');
  UPDATE campaigns SET deleted_at=now(),status='stopped' WHERE id=cid;
  r:=jsonb_build_object('success',true,'campaignId',cid,'deleted',true);
 WHEN 'list' THEN
  SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),'limit',limit_n,'offset',offset_n) INTO r FROM
   (SELECT c.*,outreach.stats(c.id) AS statistics FROM campaigns c WHERE deleted_at IS NULL ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'contacts' THEN
  SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM
   (SELECT t.* FROM contacts t JOIN campaigns c ON c.id=t.campaign_id WHERE c.deleted_at IS NULL AND (cid IS NULL OR c.id=cid) ORDER BY t.created_at DESC,t.id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'suppressions' THEN
  SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM
   (SELECT * FROM suppression_list ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'templates' THEN
  SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM
   (SELECT * FROM templates ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'deleteTemplate' THEN
  DELETE FROM templates WHERE id=(p->>'templateId')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'httpStatus',404,'error','Template not found'); END IF;
  r:=jsonb_build_object('success',true,'deleted',true);
 WHEN 'replies' THEN
  SELECT jsonb_build_object('success',true,'data',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)) INTO r FROM
   (SELECT t.* FROM replies t LEFT JOIN campaigns c ON c.id=t.campaign_id WHERE (c.id IS NULL OR c.deleted_at IS NULL) AND (cid IS NULL OR c.id=cid) ORDER BY t.received_at DESC,t.id LIMIT limit_n OFFSET offset_n) q;
 ELSE RETURN outreach.api_v1_preserved(p);
 END CASE;
 IF a IN ('delete','deleteTemplate') THEN INSERT INTO api_requests(request_key,request_body,response) VALUES(request_key_text,p,r); END IF;
 RETURN r;
EXCEPTION WHEN invalid_text_representation OR check_violation OR not_null_violation OR invalid_datetime_format OR datetime_field_overflow OR raise_exception THEN
 RETURN jsonb_build_object('success',false,'httpStatus',400,'error','Invalid input or campaign state');
END $$;
REVOKE ALL ON FUNCTION outreach.stats_v1_preserved(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION outreach.api_v1_preserved(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION outreach.api(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION outreach.api(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
