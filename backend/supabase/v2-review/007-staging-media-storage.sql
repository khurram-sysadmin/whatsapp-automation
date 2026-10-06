-- Apply only in the isolated staging Supabase project after Storage is enabled.
-- Public read is a temporary staging bridge because WASender fetches media by HTTPS URL.
-- Production must replace this with a signed-URL broker before customer rollout.
INSERT INTO storage.buckets(id,name,public) VALUES('outreach-media','outreach-media',true)
ON CONFLICT(id) DO UPDATE SET public=true;
DROP POLICY IF EXISTS outreach_media_insert ON storage.objects;
CREATE POLICY outreach_media_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='outreach-media' AND (storage.foldername(name))[1] IN
  (SELECT workspace_id::text FROM public.workspace_members WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS outreach_media_read ON storage.objects;
CREATE POLICY outreach_media_read ON storage.objects FOR SELECT TO public
USING (bucket_id='outreach-media');
