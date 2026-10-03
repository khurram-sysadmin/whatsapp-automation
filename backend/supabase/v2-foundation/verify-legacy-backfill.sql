select
    w.id as workspace_id,
    w.company_name,
    wm.role,
    s.plan_code,
    s.status as subscription_status
from public.workspaces w
join public.workspace_members wm
    on wm.workspace_id = w.id
left join public.subscriptions s
    on s.workspace_id = w.id;

select
    id,
    display_name,
    status,
    is_default
from outreach.whatsapp_sessions;

select
    count(*) as campaigns_without_workspace
from outreach.campaigns
where workspace_id is null;

select
    count(*) as contacts_without_workspace
from outreach.contacts
where workspace_id is null;

select
    count(*) as messages_without_workspace
from outreach.messages
where workspace_id is null;
