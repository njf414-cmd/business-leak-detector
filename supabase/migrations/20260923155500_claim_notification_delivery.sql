CREATE OR REPLACE FUNCTION public.claim_customer_notification_delivery(
  p_delivery_id uuid
)
RETURNS SETOF public.customer_notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.customer_notification_deliveries AS d
  SET
    status = 'processing',
    attempts = d.attempts + 1,
    last_attempt_at = now(),
    error_message = NULL,
    updated_at = now()
  WHERE d.id = p_delivery_id
    AND d.attempts < d.max_attempts
    AND (
      d.status IN (
        'pending',
        'failed'
      )
      OR (
        d.status = 'processing'
        AND (
          d.last_attempt_at IS NULL
          OR d.last_attempt_at < now() - interval '10 minutes'
        )
      )
    )
  RETURNING d.*;
END;
$$;

REVOKE ALL
ON FUNCTION public.claim_customer_notification_delivery(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.claim_customer_notification_delivery(uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';
