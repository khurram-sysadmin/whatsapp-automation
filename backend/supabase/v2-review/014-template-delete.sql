-- Archive saved templates while preserving messages and private attachment objects.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE outreach.workspace_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
INSERT INTO outreach_v2.release_function_backups(release_id,signature,definition)
VALUES('2026-10-07-template-delete','outreach_v2.api_v2(uuid,jsonb,jsonb)',pg_get_functiondef('outreach_v2.api_v2(uuid,jsonb,jsonb)'::regprocedure))
ON CONFLICT DO NOTHING;
DO $patch$
DECLARE f text;
BEGIN
 f:=pg_get_functiondef('outreach_v2.api_v2(uuid,jsonb,jsonb)'::regprocedure);
 IF strpos(f,' WHEN ''deleteTemplate'' THEN')>0 THEN RETURN; END IF;
 IF strpos(f,'''templates'',''saveTemplate''')=0 OR strpos(f,'''delete'',''saveTemplate''')=0 OR strpos(f,'WHERE workspace_id=wid ORDER BY created_at DESC,id')=0 OR strpos(f,'updated_at=now() RETURNING id INTO inserted_id;')=0 THEN
  RAISE EXCEPTION 'Unexpected template API layout; no changes applied';
 END IF;
 f:=replace(f,'''templates'',''saveTemplate''','''templates'',''saveTemplate'',''deleteTemplate''');
 f:=replace(f,'''delete'',''saveTemplate''','''delete'',''saveTemplate'',''deleteTemplate''');
 f:=replace(f,'FROM outreach.workspace_templates WHERE workspace_id=wid ORDER BY created_at DESC,id','FROM outreach.workspace_templates WHERE workspace_id=wid AND deleted_at IS NULL ORDER BY created_at DESC,id');
 -- Saving the same unique name deliberately makes it available again.
 f:=replace(f,'media_size_bytes=EXCLUDED.media_size_bytes,updated_at=now() RETURNING id INTO inserted_id;','media_size_bytes=EXCLUDED.media_size_bytes,deleted_at=NULL,updated_at=now() RETURNING id INTO inserted_id;');
 f:=replace(f,' WHEN ''suppress'' THEN',$branch$ WHEN 'deleteTemplate' THEN
  inserted_id:=nullif(p->>'templateId','')::uuid;
  IF inserted_id IS NULL THEN RETURN outreach_v2.result_v2(rid,NULL,'INVALID_REQUEST','Select a template.'); END IF;
  IF NOT EXISTS(SELECT 1 FROM outreach.workspace_templates WHERE id=inserted_id AND workspace_id=wid) THEN
   RETURN outreach_v2.result_v2(rid,NULL,'NOT_FOUND','Template not found in this workspace.');
  END IF;
  UPDATE outreach.workspace_templates SET deleted_at=coalesce(deleted_at,now()),updated_at=now() WHERE id=inserted_id AND workspace_id=wid;
  response:=jsonb_build_object('templateId',inserted_id,'deleted',true);
 WHEN 'suppress' THEN$branch$);
 EXECUTE f;
END $patch$;
COMMIT;
