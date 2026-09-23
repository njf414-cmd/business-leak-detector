import "server-only";

import {
  send,
} from "@vercel/queue";

export const NOTIFICATION_QUEUE_TOPIC =
  "notification-deliveries";

export type NotificationDeliveryMessage = {
  deliveryId: string;
};

export async function enqueueNotificationDelivery(
  deliveryId: string
) {
  return send<NotificationDeliveryMessage>(
    NOTIFICATION_QUEUE_TOPIC,
    {
      deliveryId,
    },
    {
      idempotencyKey:
        `notification-delivery:${deliveryId}`,

      retentionSeconds:
        24 * 60 * 60,
    }
  );
}
