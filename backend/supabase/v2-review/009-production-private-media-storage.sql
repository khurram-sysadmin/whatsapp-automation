-- Production media storage: private bucket with workspace-scoped access.
-- The frontend stores a short-lived signed URL; the bucket is never public.
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('outreach-media', 'outreach-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS outreach_media_insert ON storage.objects;
CREATE POLICY outreach_media_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'outreach-media'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = split_part(name, '/', 1)
  )
);

DROP POLICY IF EXISTS outreach_media_select ON storage.objects;
CREATE POLICY outreach_media_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'outreach-media'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = split_part(name, '/', 1)
  )
);

COMMIT;
