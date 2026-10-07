-- Restrict new uploads to members who can send; keep member previews private.
BEGIN;
DROP POLICY IF EXISTS outreach_media_insert ON storage.objects;
CREATE POLICY outreach_media_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='outreach-media' AND EXISTS(
 SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id=wm.workspace_id
 WHERE wm.user_id=auth.uid() AND wm.workspace_id::text=split_part(name,'/',1)
 AND wm.role IN ('owner','admin','agent') AND w.status='active'));
COMMIT;
