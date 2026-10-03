select
    table_name
from information_schema.tables
where table_schema = 'outreach'
and table_name in (
    'provider_accounts',
    'whatsapp_sessions',
    'session_sender_settings',
    'workspace_contacts',
    'workspace_suppressions',
    'workspace_templates',
    'conversations',
    'conversation_messages',
    'usage_monthly',
    'api_requests_v2',
    'platform_admins'
)
order by table_name;

select
    column_name
from information_schema.columns
where table_schema = 'outreach'
and table_name = 'campaigns'
and column_name in (
    'workspace_id',
    'whatsapp_session_id',
    'created_by',
    'deleted_at'
)
order by column_name;
