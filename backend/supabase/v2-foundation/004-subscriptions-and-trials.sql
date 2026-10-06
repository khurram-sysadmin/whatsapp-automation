-- Test-environment billing foundation. Do not apply to the client project until
-- a payment provider, prices and webhook signing secret have been selected.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS price_monthly_cents integer,
  ADD COLUMN IF NOT EXISTS provider_price_id text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;

INSERT INTO public.plans (code, name, max_whatsapp_sessions, max_team_members, max_contacts, max_monthly_messages, currency, price_monthly_cents)
VALUES
  ('trial', '3-day free trial', 2, 2, 500, 100, 'USD', 0),
  ('starter', 'Starter', 2, 5, 5000, 5000, 'USD', NULL)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, currency=EXCLUDED.currency;

UPDATE public.subscriptions
SET trial_ends_at = COALESCE(trial_ends_at, current_period_start + interval '3 days')
WHERE status='trialing' AND trial_ends_at IS NULL;

CREATE INDEX IF NOT EXISTS subscriptions_trial_ends_idx
  ON public.subscriptions(trial_ends_at)
  WHERE status='trialing';
