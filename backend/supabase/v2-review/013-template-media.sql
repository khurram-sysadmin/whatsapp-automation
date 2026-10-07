-- Add saved-template attachments without changing campaigns, subscriptions or sender schedules.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE outreach.workspace_templates
 ADD COLUMN IF NOT EXISTS media_type text,
 ADD COLUMN IF NOT EXISTS media_url text,
 ADD COLUMN IF NOT EXISTS media_mime text,
 ADD COLUMN IF NOT EXISTS media_filename text,
 ADD COLUMN IF NOT EXISTS media_size_bytes bigint;

CREATE OR REPLACE FUNCTION outreach_v2.template_json_v2(t outreach.workspace_templates)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('templateId',t.id,'name',t.name,'body',t.body,
 'mediaType',t.media_type,'mediaUrl',t.media_url,'mediaMime',t.media_mime,
 'mediaFilename',t.media_filename,'mediaSizeBytes',t.media_size_bytes);
$$;
REVOKE ALL ON FUNCTION outreach_v2.template_json_v2(outreach.workspace_templates) FROM PUBLIC,anon,authenticated,service_role;

INSERT INTO outreach_v2.release_function_backups(release_id,signature,definition)
VALUES('2026-10-07-template-media','outreach_v2.api_v2(uuid,jsonb,jsonb)',pg_get_functiondef('outreach_v2.api_v2(uuid,jsonb,jsonb)'::regprocedure))
ON CONFLICT DO NOTHING;
DO $patch$
DECLARE f text; first_pos integer; last_pos integer; old text;
BEGIN
 f:=pg_get_functiondef('outreach_v2.api_v2(uuid,jsonb,jsonb)'::regprocedure);
 first_pos:=strpos(f,' WHEN ''templates'' THEN');
 last_pos:=strpos(f,' WHEN ''suppress'' THEN');
 IF first_pos=0 OR last_pos<=first_pos THEN RAISE EXCEPTION 'Unexpected template API layout; no changes applied'; END IF;
 old:=substring(f FROM first_pos FOR last_pos-first_pos);
 f:=replace(f,old,$replacement$ WHEN 'templates' THEN
  SELECT coalesce(jsonb_agg(outreach_v2.template_json_v2(q)),'[]'::jsonb) INTO response FROM (SELECT * FROM outreach.workspace_templates WHERE workspace_id=wid ORDER BY created_at DESC,id LIMIT limit_n OFFSET offset_n) q;
 WHEN 'saveTemplate' THEN
  IF length(btrim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(p->>'body','')) NOT BETWEEN 0 AND 4096 OR (p->>'mediaType' IS NULL AND length(btrim(coalesce(p->>'body','')))<1) THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Enter a template name and message or attachment.'); END IF;
  IF length(coalesce(p->>'body',''))>0 THEN PERFORM outreach.personalize(p->>'body','{}'::jsonb); END IF;
  PERFORM outreach_v2.validate_media_v2(wid,p);
  INSERT INTO outreach.workspace_templates(workspace_id,name,body,media_type,media_url,media_mime,media_filename,media_size_bytes)
  VALUES(wid,btrim(p->>'name'),coalesce(p->>'body',''),p->>'mediaType',p->>'mediaUrl',p->>'mediaMime',p->>'mediaFilename',(p->>'mediaSizeBytes')::bigint)
  ON CONFLICT(workspace_id,name) DO UPDATE SET body=EXCLUDED.body,media_type=EXCLUDED.media_type,media_url=EXCLUDED.media_url,media_mime=EXCLUDED.media_mime,media_filename=EXCLUDED.media_filename,media_size_bytes=EXCLUDED.media_size_bytes,updated_at=now() RETURNING id INTO inserted_id;
  SELECT outreach_v2.template_json_v2(q) INTO response FROM outreach.workspace_templates q WHERE id=inserted_id AND workspace_id=wid;
$replacement$);
 EXECUTE f;
END $patch$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='outreach.workspace_templates'::regclass AND conname='workspace_templates_message_check') THEN
  ALTER TABLE outreach.workspace_templates ADD CONSTRAINT workspace_templates_message_check CHECK(length(body)<=4096 AND (length(body)>0 OR media_type IS NOT NULL)) NOT VALID;
 END IF;
END $$;
ALTER TABLE outreach.workspace_templates VALIDATE CONSTRAINT workspace_templates_message_check;
COMMIT;
