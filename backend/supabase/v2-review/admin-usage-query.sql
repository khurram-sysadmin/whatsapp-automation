-- Run in the owner's Supabase SQL Editor. No message bodies or recipient details.
SELECT r->>'owner_user_id' AS user_id,
       r->>'owner_email' AS user_email,
       (r->>'workspaces_total')::bigint AS workspaces,
       (r->>'campaigns_total')::bigint AS campaigns,
       (r->>'campaigns_running')::bigint AS running_campaigns,
       (r->>'whatsapp_accounts_registered')::bigint AS whatsapp_accounts,
       (r->>'messages_sent_month')::bigint AS messages_sent_this_month,
       (r->>'messages_sent_lifetime')::bigint AS messages_sent_lifetime,
       r->'workspaces' AS workspace_details
FROM jsonb_array_elements(outreach_v2.admin_user_usage_v2(
  (SELECT id FROM auth.users WHERE email='khurram@eightbitsolutions.com')
)) r;
