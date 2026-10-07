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
