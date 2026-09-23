import {
  handleCallback,
} from "@vercel/queue";

import type {
  NotificationDeliveryMessage,
} from "../../../lib/background/notification-queue";

import {
  deliverCustomerNotificationDelivery,
} from "../../../lib/customer-automation/notification-service";

import {
  createSupabaseWorkerClient,
} from "../../../lib/supabase-worker";

import {
  logger,
} from "../../../lib/observability/logger";

export const runtime =
  "nodejs";

export const POST =
  handleCallback<NotificationDeliveryMessage>(
    async (
      message,
      metadata
    ) => {
      const {
        deliveryId,
      } = message;

      if (
        !deliveryId ||
        typeof deliveryId !==
          "string"
      ) {
        throw new Error(
          "Queue message is missing deliveryId."
        );
      }

      const supabase =
        createSupabaseWorkerClient();

      logger.info(
        "customer_notification.queue_received",
        {
          deliveryId,
          messageId:
            metadata.messageId,
          deliveryCount:
            metadata.deliveryCount,
        }
      );

      const result =
        await deliverCustomerNotificationDelivery(
          supabase,
          deliveryId
        );

      logger.info(
        "customer_notification.queue_result",
        {
          deliveryId,
          status:
            result.status,
          reason:
            result.reason,
          providerMessageId:
            result.providerMessageId,
          deliveryCount:
            metadata.deliveryCount,
        }
      );

      if (
        result.status ===
          "failed" &&
        result.reason !==
          "max_attempts_reached"
      ) {
        throw new Error(
          result.reason ||
          "Notification delivery failed."
        );
      }

      if (
        result.status ===
          "busy"
      ) {
        throw new Error(
          "Notification delivery is already processing."
        );
      }
    },
    {
      visibilityTimeoutSeconds:
        120,

      retry: (
        _error,
        metadata
      ) => {
        if (
          metadata.deliveryCount >=
          5
        ) {
          return {
            acknowledge:
              true,
          };
        }

        return {
          afterSeconds:
            Math.min(
              300,
              15 *
                2 **
                  Math.max(
                    0,
                    metadata.deliveryCount -
                      1
                  )
            ),
        };
      },
    }
  );
