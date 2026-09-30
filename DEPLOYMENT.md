# Deployment guide

The current working edition is HTTPS Apache/PHP on cPanel. Read [CPANEL-DEPLOYMENT.md](CPANEL-DEPLOYMENT.md).

The root Dockerfile, compose.yaml and nginx.conf are retained legacy static-frontend configuration. They do not run PHP and are not a deployment option for the current private-authentication edition without a separately configured PHP server. Do not use that old deployment path as proof the dashboard backend works.

Backend installation and restore are documented in `docs/03 - Supabase Schema and Campaign Lifecycle.md` and `docs/04 - n8n Workflow and Credentials.md`. Keep database migrations/workflow imports separate from cPanel public-file upload. Existing live backend already has migrations 001–003.
