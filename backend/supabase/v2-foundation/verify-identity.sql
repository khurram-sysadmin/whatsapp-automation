select
    table_schema,
    table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
    'profiles',
    'workspaces',
    'workspace_members',
    'plans',
    'subscriptions'
)
order by table_name;

select * from public.plans;
