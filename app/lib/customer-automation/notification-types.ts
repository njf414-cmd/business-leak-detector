export type NotificationChannel =
  | "email";

export type NotificationDeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "skipped";

export type CustomerNotificationDelivery = {
  id: string;

  business_id: string;

  report_id: string;

  channel:
    NotificationChannel;

  recipient: string;

  status:
    NotificationDeliveryStatus;

  provider: string;

  provider_message_id:
    | string
    | null;

  attempts: number;

  max_attempts: number;

  error_message:
    | string
    | null;

  last_attempt_at:
    | string
    | null;

  sent_at:
    | string
    | null;

  created_at: string;

  updated_at: string;
};

export function normalizeNotificationEmail(
  value:
    | string
    | null
    | undefined
) {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}

export function isNotificationEmailValid(
  value:
    | string
    | null
    | undefined
) {
  const email =
    normalizeNotificationEmail(
      value
    );

  return (
    email.length > 3 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  );
}
