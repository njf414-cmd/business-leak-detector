CREATE TABLE IF NOT EXISTS public.customer_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id uuid NOT NULL
    REFERENCES public.businesses(id)
    ON DELETE CASCADE,

  analysis_id uuid NOT NULL UNIQUE
    REFERENCES public.analyses(id)
    ON DELETE CASCADE,

  previous_analysis_id uuid
    REFERENCES public.analyses(id)
    ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'ready'
    CHECK (
      status IN (
        'generating',
        'ready',
        'failed'
      )
    ),

  scan_date timestamptz NOT NULL,

  revenue_at_risk numeric NOT NULL DEFAULT 0,
  estimated_recovery numeric NOT NULL DEFAULT 0,
  recovered_amount numeric NOT NULL DEFAULT 0,

  leaks_found integer NOT NULL DEFAULT 0
    CHECK (leaks_found >= 0),

  new_leaks integer NOT NULL DEFAULT 0
    CHECK (new_leaks >= 0),

  resolved_leaks integer NOT NULL DEFAULT 0
    CHECK (resolved_leaks >= 0),

  previous_revenue_at_risk numeric,

  revenue_risk_change numeric NOT NULL DEFAULT 0,

  top_leaks jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_reports_business_scan_idx
  ON public.customer_reports (
    business_id,
    scan_date DESC
  );

CREATE INDEX IF NOT EXISTS customer_reports_status_idx
  ON public.customer_reports (
    status
  );

CREATE OR REPLACE FUNCTION public.set_customer_report_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_report_set_updated_at
  ON public.customer_reports;

CREATE TRIGGER customer_report_set_updated_at
BEFORE UPDATE ON public.customer_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_report_updated_at();

ALTER TABLE public.customer_reports
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own customer reports"
  ON public.customer_reports;

CREATE POLICY "Users can read own customer reports"
ON public.customer_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = customer_reports.business_id
      AND b.user_id = auth.uid()
  )
);

GRANT SELECT
  ON TABLE public.customer_reports
  TO authenticated;

GRANT ALL
  ON TABLE public.customer_reports
  TO service_role;

NOTIFY pgrst, 'reload schema';
