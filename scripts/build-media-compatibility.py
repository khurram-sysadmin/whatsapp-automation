"""Generate a narrow migration against the active function, preserving unrelated logic."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
sql_dir = root / 'backend/supabase/v2-review'
source = (sql_dir / '005-frontend-contract.sql').read_text(encoding='utf-8')
sections = [(a, b, re.search(r" WHEN '" + a + r"' THEN\n(.*?) WHEN '" + b + r"'", source, re.S).group(0).rsplit(" WHEN '", 1)[0]) for a, b in [('create', 'list'), ('messages', 'stats'), ('conversation', 'reply'), ('reply', 'markConversationRead')]]
worker = (sql_dir / 'worker-functions.sql').read_text(encoding='utf-8')
queue = re.search(r'   INSERT INTO outreach_v2.messages\(workspace_id,whatsapp_session_id,campaign_id,.*?ON CONFLICT\(contact_id\) DO NOTHING;', source, re.S).group(0)
finish = re.search(r'   INSERT INTO outreach.conversation_messages\(workspace_id,conversation_id,.*?RETURNING id INTO outbound;', worker, re.S).group(0)
helper = (sql_dir / '010-media-validation.sql').read_text(encoding='utf-8')
campaign = re.search(r'CREATE OR REPLACE FUNCTION outreach_v2.campaign_json_v2.*?\$\$;', (sql_dir / 'supabase-v2-runtime.sql').read_text(encoding='utf-8'), re.S).group(0)
out = ["-- Apply after 006 and 009. No subscriptions, customer data or schedule changes.\nBEGIN;\nSET LOCAL lock_timeout='5s';", helper,
"""CREATE TABLE IF NOT EXISTS outreach_v2.release_function_backups (
 release_id text NOT NULL, signature text NOT NULL, definition text NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(release_id,signature));
REVOKE ALL ON outreach_v2.release_function_backups FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE outreach_v2.release_function_backups ENABLE ROW LEVEL SECURITY;
INSERT INTO outreach_v2.release_function_backups(release_id,signature,definition)
SELECT '2026-10-07-media',s,pg_get_functiondef(s::regprocedure)
FROM unnest(ARRAY['outreach_v2.api_v2(uuid,jsonb,jsonb)','outreach_v2.campaign_json_v2(outreach_v2.campaigns)','outreach_v2.finish_send_v2(jsonb)']) s
ON CONFLICT DO NOTHING;
ALTER TABLE outreach_v2.campaigns DROP CONSTRAINT IF EXISTS campaigns_template_check;
ALTER TABLE outreach_v2.campaigns ADD CONSTRAINT campaigns_template_check CHECK(length(template)<=4096 AND (length(template)>0 OR media_type IS NOT NULL));
ALTER TABLE outreach_v2.messages DROP CONSTRAINT IF EXISTS messages_personalized_message_check;
ALTER TABLE outreach_v2.messages ADD CONSTRAINT messages_personalized_message_check CHECK(length(personalized_message)<=4096 AND (length(personalized_message)>0 OR media_type IS NOT NULL));
""", campaign, "DO $patch$\nDECLARE f text; old text;\nBEGIN\n f:=pg_get_functiondef('outreach_v2.api_v2(uuid,jsonb,jsonb)'::regprocedure);\n IF position('mediaType' IN f)=0 THEN"]
for a,b,new in sections:
    out += [f" old:=substring(f FROM $pattern$ WHEN '{a}' THEN.*?(?= WHEN '{b}')$pattern$);",
            f" IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing {a} section'; END IF;",
            f" f:=replace(f,old,$replacement${new}$replacement$);"]
out += [" old:=substring(f FROM $pattern$INSERT INTO outreach_v2.messages\\(workspace_id,whatsapp_session_id,campaign_id,.*?ON CONFLICT\\(contact_id\\) DO NOTHING;$pattern$);",
        " IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: missing queue insert'; END IF;",
        f" f:=replace(f,old,$replacement${queue.strip()}$replacement$);", " END IF;",
        " IF position('validate_media_v2' IN f)=0 THEN",
        " IF position('CASE a' IN f)=0 THEN RAISE EXCEPTION 'Media migration stopped: action dispatch missing'; END IF;",
        " f:=replace(f,'CASE a',$replacement$IF a IN ('create','reply') THEN PERFORM outreach_v2.validate_media_v2(wid,p); END IF; CASE a$replacement$);",
        " END IF; EXECUTE f;",
        " f:=pg_get_functiondef('outreach_v2.finish_send_v2(jsonb)'::regprocedure);",
        " IF position('m.media_type' IN f)=0 THEN",
        " old:=substring(f FROM $pattern$INSERT INTO outreach.conversation_messages\\(workspace_id,conversation_id,.*?RETURNING id INTO outbound;$pattern$);",
        " IF old IS NULL THEN RAISE EXCEPTION 'Media migration stopped: conversation insert missing'; END IF;",
        f" f:=replace(f,old,$replacement${finish.strip()}$replacement$); EXECUTE f; END IF;\nEND $patch$;\nCOMMIT;"]
(sql_dir / '011-production-media-compatibility.sql').write_text('\n'.join(out)+'\n',encoding='utf-8')
print('Generated media compatibility migration')
