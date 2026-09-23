import "server-only";

import {
  createHash,
} from "node:crypto";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  Resend,
} from "resend";

import {
  appConfig,
} from "../config/app-config";

import {
  buildReportEmail,
} from "./report-email";

import {
  isNotificationEmailValid,
  normalizeNotificationEmail,
} from "./notification-types";

type DeliveryResult = {
  status:
    | "sent"
    | "already_sent"
    | "skipped"
    | "failed";
  deliveryId:
    | string
    | null;
  providerMessageId:
    | string
    | null;
  reason:
    | string
    | null;
};

type ReportRow = {
  id: string;
  business_id: string;
  scan_date: string;
  revenue_at_risk:
    | number
    | string
    | null;
  estimated_recovery:
    | number
    | string
    | null;
  recovered_amount:
    | number
    | string
    | null;
  leaks_found:
    | number
    | string
    | null;
  new_leaks:
    | number
    | string
    | null;
  resolved_leaks:
    | number
    | string
    | null;
  revenue_risk_change:
    | number
    | string
    | null;
  top_leaks: unknown;
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function reportsUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return `${configured.replace(/\/+$/, "")}/reports`;
  }

  const productionHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/reports`;
  }

  return "https://business-leak-detector.vercel.app/reports";
}

function deliveryKey(
  reportId: string,
  recipient: string
) {
  const recipientHash =
    createHash("sha256")
      .update(recipient)
      .digest("hex")
      .slice(0, 24);

  return `bld/report/${reportId}/${recipientHash}`;
}

function topLeaks(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(
          item &&
          typeof item === "object"
        )
    )
    .map(
      (item) => ({
        customer:
          typeof item.customer === "string"
            ? item.customer
            : undefined,

        type:
          typeof item.type === "string"
            ? item.type
            : undefined,

        amount:
          numberValue(
            item.amount as
              | number
              | string
              | null
          ),

        recovery:
          numberValue(
            item.recovery as
              | number
              | string
              | null
          ),

        priorityLevel:
          typeof item.priorityLevel === "string"
            ? item.priorityLevel
            : undefined,

        action:
          typeof item.action === "string"
            ? item.action
            : undefined,
      })
    )
    .slice(0, 5);
}

export async function deliverCustomerReportNotification(
  supabase: SupabaseClient,
  reportId: string,
  businessId: string
): Promise<DeliveryResult> {
  if (
    !appConfig.features.customerNotifications
  ) {
    return {
      status: "skipped",
      deliveryId: null,
      providerMessageId: null,
      reason: "feature_disabled",
    };
  }

  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from(
      "customer_automation_settings"
    )
    .select(
      "notifications_enabled,notification_email"
    )
    .eq(
      "business_id",
      businessId
    )
    .maybeSingle();

  if (settingsError) {
    throw new Error(
      `Could not load notification settings: ${settingsError.message}`
    );
  }

  if (
    !settings?.notifications_enabled
  ) {
    return {
      status: "skipped",
      deliveryId: null,
      providerMessageId: null,
      reason: "notifications_disabled",
    };
  }

  const recipient =
    normalizeNotificationEmail(
      settings.notification_email
    );

  if (
    !isNotificationEmailValid(
      recipient
    )
  ) {
    return {
      status: "skipped",
      deliveryId: null,
      providerMessageId: null,
      reason: "invalid_notification_email",
    };
  }

  const {
    data: report,
    error: reportError,
  } = await supabase
    .from(
      "customer_reports"
    )
    .select(
      "id,business_id,scan_date,revenue_at_risk,estimated_recovery,recovered_amount,leaks_found,new_leaks,resolved_leaks,revenue_risk_change,top_leaks"
    )
    .eq(
      "id",
      reportId
    )
    .eq(
      "business_id",
      businessId
    )
    .single();

  if (
    reportError ||
    !report
  ) {
    throw new Error(
      `Could not load report for notification: ${
        reportError?.message ??
        "report not found"
      }`
    );
  }

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("name")
    .eq(
      "id",
      businessId
    )
    .single();

  if (
    businessError ||
    !business
  ) {
    throw new Error(
      `Could not load business for notification: ${
        businessError?.message ??
        "business not found"
      }`
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from(
      "customer_notification_deliveries"
    )
    .select(
      "id,status,provider_message_id,attempts,max_attempts"
    )
    .eq(
      "report_id",
      reportId
    )
    .eq(
      "channel",
      "email"
    )
    .eq(
      "recipient",
      recipient
    )
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Could not inspect notification delivery: ${existingError.message}`
    );
  }

  if (
    existing?.status === "sent"
  ) {
    return {
      status: "already_sent",
      deliveryId: existing.id,
      providerMessageId:
        existing.provider_message_id,
      reason: null,
    };
  }

  if (
    existing &&
    Number(existing.attempts) >=
      Number(
        existing.max_attempts
      )
  ) {
    return {
      status: "failed",
      deliveryId: existing.id,
      providerMessageId:
        existing.provider_message_id,
      reason: "max_attempts_reached",
    };
  }

  let deliveryId =
    existing?.id ?? null;

  if (!deliveryId) {
    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from(
        "customer_notification_deliveries"
      )
      .upsert(
        {
          business_id:
            businessId,

          report_id:
            reportId,

          channel:
            "email",

          recipient,

          status:
            "pending",

          provider:
            "resend",

          attempts:
            0,

          max_attempts:
            5,
        },
        {
          onConflict:
            "report_id,channel,recipient",

          ignoreDuplicates:
            false,
        }
      )
      .select(
        "id,status,provider_message_id,attempts,max_attempts"
      )
      .single();

    if (
      insertError ||
      !inserted
    ) {
      throw new Error(
        `Could not create notification delivery: ${
          insertError?.message ??
          "delivery missing"
        }`
      );
    }

    if (
      inserted.status === "sent"
    ) {
      return {
        status: "already_sent",
        deliveryId:
          inserted.id,
        providerMessageId:
          inserted.provider_message_id,
        reason: null,
      };
    }

    deliveryId =
      inserted.id;
  }

  const {
    data: latest,
    error: latestError,
  } = await supabase
    .from(
      "customer_notification_deliveries"
    )
    .select(
      "id,status,provider_message_id,attempts,max_attempts"
    )
    .eq(
      "id",
      deliveryId
    )
    .single();

  if (
    latestError ||
    !latest
  ) {
    throw new Error(
      `Could not reload notification delivery: ${
        latestError?.message ??
        "delivery missing"
      }`
    );
  }

  if (
    latest.status === "sent"
  ) {
    return {
      status: "already_sent",
      deliveryId:
        latest.id,
      providerMessageId:
        latest.provider_message_id,
      reason: null,
    };
  }

  const nextAttempt =
    Number(
      latest.attempts
    ) + 1;

  if (
    nextAttempt >
    Number(
      latest.max_attempts
    )
  ) {
    return {
      status: "failed",
      deliveryId:
        latest.id,
      providerMessageId:
        latest.provider_message_id,
      reason:
        "max_attempts_reached",
    };
  }

  const attemptAt =
    new Date().toISOString();

  const {
    error: processingError,
  } = await supabase
    .from(
      "customer_notification_deliveries"
    )
    .update({
      status:
        "processing",

      attempts:
        nextAttempt,

      last_attempt_at:
        attemptAt,

      error_message:
        null,
    })
    .eq(
      "id",
      deliveryId
    );

  if (processingError) {
    throw new Error(
      `Could not claim notification delivery: ${processingError.message}`
    );
  }

  const resendKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.RESEND_FROM_EMAIL?.trim();

  if (
    !resendKey ||
    !from
  ) {
    const reason =
      !resendKey
        ? "RESEND_API_KEY is missing"
        : "RESEND_FROM_EMAIL is missing";

    await supabase
      .from(
        "customer_notification_deliveries"
      )
      .update({
        status:
          "failed",

        error_message:
          reason,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        deliveryId
      );

    return {
      status:
        "failed",
      deliveryId,
      providerMessageId:
        null,
      reason,
    };
  }

  const email =
    buildReportEmail({
      businessName:
        business.name,

      reportUrl:
        reportsUrl(),

      scanDate:
        (
          report as ReportRow
        ).scan_date,

      revenueAtRisk:
        numberValue(
          (
            report as ReportRow
          ).revenue_at_risk
        ),

      estimatedRecovery:
        numberValue(
          (
            report as ReportRow
          ).estimated_recovery
        ),

      recoveredAmount:
        numberValue(
          (
            report as ReportRow
          ).recovered_amount
        ),

      leaksFound:
        numberValue(
          (
            report as ReportRow
          ).leaks_found
        ),

      newLeaks:
        numberValue(
          (
            report as ReportRow
          ).new_leaks
        ),

      resolvedLeaks:
        numberValue(
          (
            report as ReportRow
          ).resolved_leaks
        ),

      revenueRiskChange:
        numberValue(
          (
            report as ReportRow
          ).revenue_risk_change
        ),

      topLeaks:
        topLeaks(
          (
            report as ReportRow
          ).top_leaks
        ),
    });

  const resend =
    new Resend(
      resendKey
    );

  const {
    data,
    error,
  } = await resend.emails.send(
    {
      from,
      to: [
        recipient,
      ],
      subject:
        email.subject,
      html:
        email.html,
      text:
        email.text,
    },
    {
      idempotencyKey:
        deliveryKey(
          reportId,
          recipient
        ),
    }
  );

  if (
    error ||
    !data?.id
  ) {
    const message =
      error?.message ??
      "Resend did not return a message id.";

    await supabase
      .from(
        "customer_notification_deliveries"
      )
      .update({
        status:
          "failed",

        error_message:
          message.slice(
            0,
            2000
          ),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        deliveryId
      );

    return {
      status:
        "failed",
      deliveryId,
      providerMessageId:
        null,
      reason:
        message,
    };
  }

  const sentAt =
    new Date().toISOString();

  const {
    error: sentError,
  } = await supabase
    .from(
      "customer_notification_deliveries"
    )
    .update({
      status:
        "sent",

      provider_message_id:
        data.id,

      error_message:
        null,

      sent_at:
        sentAt,

      updated_at:
        sentAt,
    })
    .eq(
      "id",
      deliveryId
    );

  if (sentError) {
    throw new Error(
      `Email was accepted but delivery state could not be saved: ${sentError.message}`
    );
  }

  return {
    status:
      "sent",
    deliveryId,
    providerMessageId:
      data.id,
    reason:
      null,
  };
}
