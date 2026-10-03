// Local reproduction only. No HTTP, provider calls or real customer data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const sql=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
for(const file of ['001-base.sql','002-production-hardening.sql','003-campaign-lifecycle.sql'])await db.exec(sql('../backend/supabase/'+file));
await db.exec(sql('../backend/supabase/v2-foundation/001-identity.sql').replace('CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;',''));
await db.exec(sql('../backend/supabase/v2-foundation/002-private-saas-tables.sql'));
const owner='11111111-1111-4111-8111-111111111111';
await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'fixture@example.test','{}')",[owner]);
const workspace=(await db.query("INSERT INTO public.workspaces(company_name,slug,created_by) VALUES('Other customer fixture','other-customer-fixture',$1) RETURNING id",[owner])).rows[0].id;
const session=(await db.query("INSERT INTO outreach.whatsapp_sessions(workspace_id,display_name,status) VALUES($1,'Other customer session','connected') RETURNING id",[workspace])).rows[0].id;
const campaign=(await db.query("INSERT INTO outreach.campaigns(name,template,status,timezone,sending_start_time,sending_end_time,workspace_id,whatsapp_session_id,created_by) VALUES('V2 fixture','Hello','running','UTC','00:00','00:00',$1,$2,$3) RETURNING id",[workspace,session,owner])).rows[0].id;
const contact=(await db.query("INSERT INTO outreach.contacts(campaign_id,phone,workspace_id) VALUES($1,'+12025550199',$2) RETURNING id",[campaign,workspace])).rows[0].id;
await db.query("INSERT INTO outreach.messages(campaign_id,contact_id,phone,personalized_message,workspace_id,whatsapp_session_id) VALUES($1,$2,'+12025550199','Fixture only',$3,$4)",[campaign,contact,workspace,session]);
await db.exec('UPDATE outreach.sender_settings SET enabled=true,next_send_at=now()-interval \'1 minute\'');
const claimed=(await db.query('SELECT * FROM outreach.claim_next()')).rows;
assert.equal(claimed.length,1);
assert.equal(claimed[0].workspace_id,workspace);
assert.equal(claimed[0].whatsapp_session_id,session);
const dispatched=(await db.query('SELECT * FROM outreach.begin_send($1,$2)',[claimed[0].id,claimed[0].lease_token])).rows;
assert.equal(dispatched.length,1);
assert.equal(dispatched[0].status,'dispatching');
const report={reproductionConfirmed:true,noExternalCalls:true,liveDataChanged:false,findings:[
 'The unchanged v1 claim_next leases a message assigned to another workspace and session',
 'The unchanged v1 begin_send also authorizes that message using the global sender settings',
 'The existing n8n send node uses one fixed WASender credential, so shared v2 queue activation requires explicit dispatch isolation',
 'JWT and workspace authorization in v2 API cannot prevent the scheduled v1 worker from independently claiming shared rows'
]};
console.log(JSON.stringify(report));
await db.close();
