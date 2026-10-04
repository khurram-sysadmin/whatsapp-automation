-- Private latest failure metadata only. Never store keys, phone numbers or provider bodies.
BEGIN;
CREATE TABLE IF NOT EXISTS outreach_v2.connection_checks (
 whatsapp_session_id uuid PRIMARY KEY REFERENCES outreach.whatsapp_sessions(id),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 phase text NOT NULL CHECK (phase IN ('status','identity')),
 http_status integer NOT NULL CHECK (http_status BETWEEN 0 AND 599),
 reason text NOT NULL CHECK (reason IN ('status_http','status_unknown','status_disconnected','user_http','user_envelope','user_missing_id','user_invalid_phone')),
 checked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE outreach_v2.connection_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON outreach_v2.connection_checks FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.eb_outreach_record_connection_check_v2(
 user_id uuid, whatsapp_session_id uuid, phase text, http_status integer, reason text, request_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE wid uuid;
BEGIN
 SELECT s.workspace_id INTO wid FROM outreach.whatsapp_sessions s WHERE s.id=whatsapp_session_id AND s.deleted_at IS NULL;
 IF wid IS NULL OR NOT outreach_v2.allowed_v2(wid,user_id) THEN
  RETURN outreach_v2.result_v2('connection-check',NULL,'FORBIDDEN','Connection access denied.');
 END IF;
 IF phase IS NULL OR phase NOT IN ('status','identity') OR http_status IS NULL OR http_status NOT BETWEEN 0 AND 599
 OR reason IS NULL OR NOT ((phase='status' AND reason IN ('status_http','status_unknown','status_disconnected'))
 OR (phase='identity' AND reason IN ('user_http','user_envelope','user_missing_id','user_invalid_phone'))) THEN
  RETURN outreach_v2.result_v2('connection-check',NULL,'INVALID_REQUEST','Invalid connection check.');
 END IF;
 INSERT INTO outreach_v2.connection_checks AS c(whatsapp_session_id,workspace_id,phase,http_status,reason)
 VALUES(whatsapp_session_id,wid,phase,http_status,reason)
 ON CONFLICT ON CONSTRAINT connection_checks_pkey DO UPDATE SET phase=excluded.phase,http_status=excluded.http_status,reason=excluded.reason,checked_at=now();
 RETURN outreach_v2.result_v2(CASE WHEN request_id ~ '^[A-Za-z0-9_-]{1,128}$' THEN request_id ELSE 'connection-check' END,
 NULL,'PROVIDER_NOT_CONNECTED','Unable to verify this WhatsApp connection.');
END $$;
REVOKE ALL ON FUNCTION public.eb_outreach_record_connection_check_v2(uuid,uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eb_outreach_record_connection_check_v2(uuid,uuid,text,integer,text,text) TO service_role;
COMMIT;
