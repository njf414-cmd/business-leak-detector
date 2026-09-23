CREATE TABLE public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id uuid NOT NULL
    REFERENCES public.businesses(id)
    ON DELETE CASCADE,

  analysis_id uuid
    REFERENCES public.analyses(id)
    ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'queued'
    CHECK (
      status IN (
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  progress integer NOT NULL DEFAULT 0
    CHECK (
      progress >= 0
      AND progress <= 100
    ),

  source_file_name text,
  source_path text NOT NULL,

  industry text,
  mapping_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,

  attempts integer NOT NULL DEFAULT 0
    CHECK (attempts >= 0),

  max_attempts integer NOT NULL DEFAULT 3
    CHECK (max_attempts >= 1),

  error_message text,

  locked_at timestamp with time zone,
  locked_by text,

  created_at timestamp with time zone
    NOT NULL DEFAULT now(),

  started_at timestamp with time zone,

  completed_at timestamp with time zone,

  updated_at timestamp with time zone
    NOT NULL DEFAULT now()
);

CREATE INDEX analysis_jobs_business_id_idx
  ON public.analysis_jobs(business_id);

CREATE INDEX analysis_jobs_status_created_at_idx
  ON public.analysis_jobs(status, created_at);

CREATE INDEX analysis_jobs_analysis_id_idx
  ON public.analysis_jobs(analysis_id);

ALTER TABLE public.analysis_jobs
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis jobs"
  ON public.analysis_jobs
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT businesses.id
      FROM public.businesses
      WHERE businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own analysis jobs"
  ON public.analysis_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT businesses.id
      FROM public.businesses
      WHERE businesses.user_id = auth.uid()
    )
  );
