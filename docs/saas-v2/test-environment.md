# Isolated test environment

This branch is `test/subscriptions-timezones`. It is a separate Git worktree at `outputs/whatsapp-automation-test` and is not the production branch. It has no production deployment, n8n publish, Supabase SQL execution, or cPanel upload attached to it.

## Required staging boundary

Create a separate Supabase project, a separate n8n workflow copied from the production workflow, and a separate cPanel subdomain/document root such as `wamarketing-test.edwardsolutions.com`. Use a separate WASender account/session for test messages. Never point the staging build at the client's Supabase project, production n8n workflow, production webhook, or client WASender session.

Copy `.env.test.example` to a private `.env.test` and fill it with staging-only values. Do not commit that file. Apply the ordered foundation/review migrations to the staging Supabase project only. Import the workflow export into staging as inactive, then configure its staging Supabase credential and staging webhook before enabling any scheduler.

## Current test-branch changes

- The browser exposes the full IANA timezone catalog supported by the browser, including Saudi Arabia (`Asia/Riyadh`) and daylight-saving zones. The backend already validates IANA identifiers and stores the selected zone with each workspace/campaign.
- New workspaces receive a `trial` plan with `trialing` status and a three-day `trial_ends_at`. Trial sending is allowed only while that timestamp has not passed. The worker refuses expired trials without deleting data or retrying messages.
- The subscription response exposes plan, status, trial end, billing provider, checkout URL and period end. The Billing page clearly displays the trial end or expired state.
- A paid `starter` plan catalog row is prepared without a price or provider ID. Checkout is intentionally not enabled until the payment provider and prices are selected.

## Verification completed

The isolated branch passes the production build, v2 frontend checks, v2 runtime checks, and lifecycle checks. The runtime fixture uses a mocked Vault and makes no external calls. This is code/test verification only; it is not permission to deploy or enable a scheduler.

## Promotion gate

Before any production promotion, create a staging test account, confirm the 3-day clock and expired-trial sending block, test every listed timezone (including `Asia/Riyadh`), run an authorized test message, verify signed callbacks, and review tenant isolation. Only after those checks pass should the changes be cherry-picked or merged into the production branch.

