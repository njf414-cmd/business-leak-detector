CREATE TABLE IF NOT EXISTS public.customer_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id uuid NOT NULL
    REFERENCES public.businesses(id)
    ON DELETE CASCADE,

  report_id uuid NOT NULL
    REFERENCES public.customer_reports(id)
    ON DELETE CASCADE,

  channel text NOT NULL DEFAULT 'email'
    CHECK (
      channel IN (
        'email'
      )
    ),

  recipient text NOT NULL,

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'processing',
        'sent',
        'failed',
        'skipped'
      )
    ),

  provider text NOT NULL DEFAULT 'resend',

  provider_message_id text,

  attempts integer NOT NULL DEFAULT 0
    CHECK (attempts >= 0),

  max_attempts integer NOT NULL DEFAULT 5
    CHECK (max_attempts >= 1),

  error_message text,

  last_attempt_at timestamptz,

  sent_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT customer_notification_delivery_unique
    UNIQUE (
      report_id,
      channel,
      recipient
    )
);

CREATE INDEX IF NOT EXISTS customer_notification_delivery_status_idx
  ON public.customer_notification_deliveries (
    status,
    created_at
  );

CREATE INDEX IF NOT EXISTS customer_notification_delivery_business_idx
  ON public.customer_notification_deliveries (
    business_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS customer_notification_delivery_report_idx
  ON public.customer_notification_deliveries (
    report_id
  );

CREATE OR REPLACE FUNCTION public.set_customer_notification_delivery_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_notification_delivery_set_updated_at
  ON public.customer_notification_deliveries;

CREATE TRIGGER customer_notification_delivery_set_updated_at
BEFORE UPDATE
ON public.customer_notification_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_notification_delivery_updated_at();

ALTER TABLE public.customer_notification_deliveries
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification deliveries"
  ON public.customer_notification_deliveries;

CREATE POLICY "Users can read own notification deliveries"
ON public.customer_notification_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id =
      customer_notification_deliveries.business_id
      AND b.user_id = auth.uid()
  )
);

GRANT SELECT
  ON TABLE public.customer_notification_deliveries
  TO authenticated;

GRANT ALL
  ON TABLE public.customer_notification_deliveries
  TO service_role;

NOTIFY pgrst, 'reload schema';
