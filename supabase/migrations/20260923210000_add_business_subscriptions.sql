CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id uuid NOT NULL UNIQUE
    REFERENCES public.businesses(id)
    ON DELETE CASCADE,

  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro')),

  status text NOT NULL DEFAULT 'inactive'
    CHECK (
      status IN (
        'inactive',
        'trialing',
        'active',
        'past_due',
        'canceled'
      )
    ),

  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,

  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.business_subscriptions
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "Users can view their own subscription"
  ON public.business_subscriptions;

CREATE POLICY
  "Users can view their own subscription"
  ON public.business_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT businesses.id
      FROM public.businesses
      WHERE businesses.user_id = auth.uid()
    )
  );

GRANT SELECT
  ON TABLE public.business_subscriptions
  TO authenticated;

GRANT ALL
  ON TABLE public.business_subscriptions
  TO service_role;

CREATE INDEX IF NOT EXISTS
  business_subscriptions_business_id_idx
  ON public.business_subscriptions(business_id);

CREATE INDEX IF NOT EXISTS
  business_subscriptions_stripe_customer_id_idx
  ON public.business_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS
  business_subscriptions_stripe_subscription_id_idx
  ON public.business_subscriptions(stripe_subscription_id);
