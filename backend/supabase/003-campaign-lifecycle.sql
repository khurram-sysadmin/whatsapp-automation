-- Campaign lifecycle fix: no sends, no message deletion, no credential changes.
BEGIN;
SELECT pg_advisory_xact_lock(824601);
CREATE INDEX IF NOT EXISTS messages_campaign_pending ON outreach.messages(campaign_id) WHERE status IN ('queued','leased','dispatching');
CREATE OR REPLACE FUNCTION outreach.complete_finished_campaign(cid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
BEGIN
 UPDATE campaigns c SET status='completed',completed_at=coalesce(completed_at,now())
 WHERE c.id=cid AND c.deleted_at IS NULL AND c.started_at IS NOT NULL AND c.status IN ('running','paused')
 AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.campaign_id=c.id AND m.status IN ('queued','leased','dispatching'));
END $$;
CREATE OR REPLACE FUNCTION outreach.complete_after_message_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
BEGIN
 PERFORM outreach.complete_finished_campaign(NEW.campaign_id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS complete_campaign_after_message ON outreach.messages;
CREATE TRIGGER complete_campaign_after_message AFTER UPDATE OF status ON outreach.messages
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION outreach.complete_after_message_change();
REVOKE ALL ON FUNCTION outreach.complete_finished_campaign(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION outreach.complete_after_message_change() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION outreach.api(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=outreach,pg_temp AS $$
DECLARE a text:=p->>'action'; cid uuid; stored_campaign campaigns; r jsonb; old api_requests; request_key_text text:=p->>'requestId';
 limit_n integer:=greatest(1,least(200,coalesce((p->>'limit')::integer,50))); offset_n integer:=greatest(0,coalesce((p->>'offset')::integer,0));
BEGIN
 PERFORM pg_advisory_xact_lock(824601);
 IF p ? 'campaignId' THEN cid:=(p->>'campaignId')::uuid; END IF;
 IF a IN ('delete','deleteTemplate','start','pause','resume','stop') THEN
  IF request_key_text IS NULL OR length(request_key_text) NOT BETWEEN 8 AND 128 THEN RETURN jsonb_build_object('success',false,'httpStatus',400,'error','requestId must be 8-128 characters'); END IF;
  SELECT * INTO old FROM api_requests WHERE request_key=request_key_text;
  IF FOUND THEN
   IF old.request_body<>p THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','requestId already used for another request'); END IF;
   RETURN old.response;
  END IF;
 END IF;
 IF cid IS NOT NULL THEN
  SELECT * INTO stored_campaign FROM campaigns WHERE id=cid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'httpStatus',404,'error','Campaign not found'); END IF;
  IF stored_campaign.deleted_at IS NOT NULL THEN
   IF a='delete' THEN
    r:=jsonb_build_object('success',true,'campaignId',cid,'deleted',true);
    INSERT INTO api_requests(request_key,request_body,response) VALUES(request_key_text,p,r);
    RETURN r;
   END IF;
   RETURN jsonb_build_object('success',false,'httpStatus',404,'error','Campaign not found');
  END IF;
  PERFORM outreach.complete_finished_campaign(cid);
  SELECT * INTO stored_campaign FROM campaigns WHERE id=cid;
 END IF;
 IF a IN ('start','pause','resume','stop') AND cid IS NULL THEN
  RETURN jsonb_build_object('success',false,'httpStatus',400,'error','campaignId required');
 END IF;
 IF a='start' AND stored_campaign.status='completed' THEN
  RETURN jsonb_build_object('success',false,'httpStatus',409,'error','Completed campaigns cannot restart. Create a new campaign.');
 END IF;
 IF a IN ('pause','resume','stop') AND stored_campaign.status='completed' THEN
  r:=jsonb_build_object('success',true,'campaignId',cid,'status','completed');
  INSERT INTO api_requests(request_key,request_body,response) VALUES(request_key_text,p,r);
  RETURN r;
 END IF;
 CASE a
 WHEN 'delete' THEN
  IF cid IS NULL THEN RETURN jsonb_build_object('success',false,'httpStatus',400,'error','campaignId required'); END IF;
  IF stored_campaign.status NOT IN ('draft','paused','stopped','completed') THEN RETURN jsonb_build_object('success',false,'httpStatus',409,'error','Pause or stop the campaign before deletion'); END IF;
  -- Archive only: preserve uncertain and in-flight outcomes and all audit records.
  UPDATE messages SET status='canceled',lease_token=NULL,lease_until=NULL,error='Campaign deleted' WHERE campaign_id=cid AND status IN ('queued','leased');
  UPDATE campaigns SET deleted_at=now(),status=CASE WHEN status='completed' THEN 'completed' ELSE 'stopped' END WHERE id=cid;
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
 IF a IN ('delete','deleteTemplate','start','pause','resume','stop') THEN INSERT INTO api_requests(request_key,request_body,response) VALUES(request_key_text,p,r); END IF;
 RETURN r;
EXCEPTION WHEN invalid_text_representation OR check_violation OR not_null_violation OR invalid_datetime_format OR datetime_field_overflow OR raise_exception THEN
 RETURN jsonb_build_object('success',false,'httpStatus',400,'error','Invalid input or campaign state');
END $$;
-- Reconcile existing finished active campaigns once; drafts and stopped campaigns stay unchanged.
SELECT outreach.complete_finished_campaign(id) FROM outreach.campaigns WHERE deleted_at IS NULL AND status IN ('running','paused');
REVOKE ALL ON FUNCTION outreach.api(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION outreach.api(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
