-- Milestone 9: safe background-job claiming.
DROP POLICY IF EXISTS "Users can create their own analysis jobs" ON public.analysis_jobs;

CREATE POLICY "Users can create queued analysis jobs"
ON public.analysis_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT businesses.id
    FROM public.businesses
    WHERE businesses.user_id = auth.uid()
  )
  AND status = 'queued'
  AND progress = 0
  AND analysis_id IS NULL
  AND attempts = 0
  AND error_message IS NULL
  AND locked_at IS NULL
  AND locked_by IS NULL
  AND started_at IS NULL
  AND completed_at IS NULL
);

CREATE OR REPLACE FUNCTION public.claim_analysis_job(
  p_job_id uuid,
  p_worker_id text,
  p_stale_after_seconds integer DEFAULT 900
)
RETURNS SETOF public.analysis_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.analysis_jobs AS j
  SET
    status = 'processing',
    progress = GREATEST(j.progress, 1),
    attempts = j.attempts + 1,
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = COALESCE(j.started_at, now()),
    updated_at = now(),
    error_message = NULL
  WHERE
    j.id = p_job_id
    AND j.attempts < j.max_attempts
    AND (
      j.status = 'queued'
      OR (
        j.status = 'processing'
        AND j.locked_at IS NOT NULL
        AND j.locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 60))
      )
    )
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_analysis_job(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_analysis_job(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_analysis_job(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis_job(uuid, text, integer) TO service_role;
