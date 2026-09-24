import { getBusinessEntitlements } from "../billing/entitlements";
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

type PreparedNotificationResult = {
  status:
    | "queued"
    | "already_sent"
    | "skipped"
    | "failed";

  deliveryId:
    | string
    | null;

  reason:
    | string
    | null;
};

export type NotificationDeliveryResult = {
  status:
    | "sent"
    | "already_sent"
    | "skipped"
    | "failed"
    | "busy";

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

type DeliveryRow = {
  id: string;
  business_id: string;
  report_id: string;
  recipient: string;
  status: string;
  provider_message_id:
    | string
    | null;
  attempts: number;
  max_attempts: number;
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
    return (
      configured.replace(
        /\/+$/,
        ""
      ) +
      "/reports"
    );
  }

  const productionHost =
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL
      ?.trim();

  if (productionHost) {
    return (
      "https://" +
      productionHost
        .replace(
          /^https?:\/\//,
          ""
        )
        .replace(
          /\/+$/,
          ""
        ) +
      "/reports"
    );
  }

  return "https://business-leak-detector.vercel.app/reports";
}

function deliveryKey(
  reportId: string,
  recipient: string
) {
  const recipientHash =
    createHash(
      "sha256"
    )
      .update(
        recipient
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        24
      );

  return (
    `bld/report/${reportId}/` +
    recipientHash
  );
}

function parseTopLeaks(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
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
          typeof item ===
            "object"
        )
    )
    .map(
      (item) => ({
        customer:
          typeof item.customer ===
          "string"
            ? item.customer
            : undefined,

        type:
          typeof item.type ===
          "string"
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
          typeof item.priorityLevel ===
          "string"
            ? item.priorityLevel
            : undefined,

        action:
          typeof item.action ===
          "string"
            ? item.action
            : undefined,
      })
    )
    .slice(
      0,
      5
    );
}

async function getExistingDelivery(
  supabase: SupabaseClient,
  reportId: string,
  recipient: string
) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "customer_notification_deliveries"
    )
    .select(
      "id,business_id,report_id,recipient,status,provider_message_id,attempts,max_attempts"
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

  if (error) {
    throw new Error(
      `Could not inspect notification delivery: ${error.message}`
    );
  }

  return (
    data as
      | DeliveryRow
      | null
  );
}

export async function prepareCustomerReportNotification(
  supabase: SupabaseClient,
  reportId: string,
  businessId: string
): Promise<PreparedNotificationResult> {
  if (
    !appConfig.features
      .customerNotifications
  ) {
    return {
      status:
        "skipped",

      deliveryId:
        null,

      reason:
        "feature_disabled",
    };
  }

  const entitlements = await getBusinessEntitlements(
    supabase,
    businessId
  );

  if (!entitlements.hasProAccess) {
    return {
      status: "skipped",
      deliveryId: null,
      reason: "pro_required",
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
    !settings
      ?.notifications_enabled
  ) {
    return {
      status:
        "skipped",

      deliveryId:
        null,

      reason:
        "notifications_disabled",
    };
  }

  const recipient =
    normalizeNotificationEmail(
      settings
        .notification_email
    );

  if (
    !isNotificationEmailValid(
      recipient
    )
  ) {
    return {
      status:
        "skipped",

      deliveryId:
        null,

      reason:
        "invalid_notification_email",
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
      "id"
    )
    .eq(
      "id",
      reportId
    )
    .eq(
      "business_id",
      businessId
    )
    .maybeSingle();

  if (
    reportError ||
    !report
  ) {
    throw new Error(
      `Could not validate report for notification: ${
        reportError?.message ??
        "report not found"
      }`
    );
  }

  const existing =
    await getExistingDelivery(
      supabase,
      reportId,
      recipient
    );

  if (
    existing
      ?.status ===
    "sent"
  ) {
    return {
      status:
        "already_sent",

      deliveryId:
        existing.id,

      reason:
        null,
    };
  }

  if (
    existing &&
    Number(
      existing.attempts
    ) >=
      Number(
        existing.max_attempts
      )
  ) {
    return {
      status:
        "failed",

      deliveryId:
        existing.id,

      reason:
        "max_attempts_reached",
    };
  }

  if (existing) {
    return {
      status:
        "queued",

      deliveryId:
        existing.id,

      reason:
        null,
    };
  }

  const {
    data: inserted,
    error: insertError,
  } = await supabase
    .from(
      "customer_notification_deliveries"
    )
    .insert({
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
    })
    .select(
      "id"
    )
    .single();

  if (insertError) {
    if (
      insertError.code ===
      "23505"
    ) {
      const duplicate =
        await getExistingDelivery(
          supabase,
          reportId,
          recipient
        );

      if (!duplicate) {
        throw new Error(
          "Notification delivery conflict occurred but delivery could not be found."
        );
      }

      return {
        status:
          duplicate.status ===
          "sent"
            ? "already_sent"
            : "queued",

        deliveryId:
          duplicate.id,

        reason:
          null,
      };
    }

    throw new Error(
      `Could not create notification delivery: ${insertError.message}`
    );
  }

  return {
    status:
      "queued",

    deliveryId:
      inserted.id,

    reason:
      null,
  };
}

async function markDeliveryFailed(
  supabase: SupabaseClient,
  deliveryId: string,
  message: string
) {
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
    )
    .eq(
      "status",
      "processing"
    );
}

export async function deliverCustomerNotificationDelivery(
  supabase: SupabaseClient,
  deliveryId: string
): Promise<NotificationDeliveryResult> {
  if (
    !appConfig.features
      .customerNotifications
  ) {
    return {
      status:
        "skipped",

      deliveryId,

      providerMessageId:
        null,

      reason:
        "feature_disabled",
    };
  }

  const {
    data: claimRows,
    error: claimError,
  } = await supabase.rpc(
    "claim_customer_notification_delivery",
    {
      p_delivery_id:
        deliveryId,
    }
  );

  if (claimError) {
    throw new Error(
      `Could not claim notification delivery: ${claimError.message}`
    );
  }

  const claimed =
    Array.isArray(
      claimRows
    )
      ? (
          claimRows[0] as
            | DeliveryRow
            | undefined
        )
      : undefined;

  if (!claimed) {
    const {
      data: current,
      error: currentError,
    } = await supabase
      .from(
        "customer_notification_deliveries"
      )
      .select(
        "id,business_id,report_id,recipient,status,provider_message_id,attempts,max_attempts"
      )
      .eq(
        "id",
        deliveryId
      )
      .maybeSingle();

    if (currentError) {
      throw new Error(
        `Could not inspect unclaimed notification: ${currentError.message}`
      );
    }

    if (!current) {
      return {
        status:
          "failed",

        deliveryId,

        providerMessageId:
          null,

        reason:
          "delivery_not_found",
      };
    }

    if (
      current.status ===
      "sent"
    ) {
      return {
        status:
          "already_sent",

        deliveryId:
          current.id,

        providerMessageId:
          current
            .provider_message_id,

        reason:
          null,
      };
    }

    if (
      Number(
        current.attempts
      ) >=
      Number(
        current.max_attempts
      )
    ) {
      return {
        status:
          "failed",

        deliveryId:
          current.id,

        providerMessageId:
          current
            .provider_message_id,

        reason:
          "max_attempts_reached",
      };
    }

    return {
      status:
        "busy",

      deliveryId:
        current.id,

      providerMessageId:
        current
          .provider_message_id,

      reason:
        "delivery_not_claimed",
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
      claimed.report_id
    )
    .eq(
      "business_id",
      claimed.business_id
    )
    .single();

  if (
    reportError ||
    !report
  ) {
    const message =
      `Could not load report for notification: ${
        reportError?.message ??
        "report not found"
      }`;

    await markDeliveryFailed(
      supabase,
      deliveryId,
      message
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

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from(
      "businesses"
    )
    .select(
      "name"
    )
    .eq(
      "id",
      claimed.business_id
    )
    .single();

  if (
    businessError ||
    !business
  ) {
    const message =
      `Could not load business for notification: ${
        businessError?.message ??
        "business not found"
      }`;

    await markDeliveryFailed(
      supabase,
      deliveryId,
      message
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

  const resendKey =
    process.env
      .RESEND_API_KEY;

  const from =
    process.env
      .RESEND_FROM_EMAIL
      ?.trim();

  if (
    !resendKey ||
    !from
  ) {
    const message =
      !resendKey
        ? "RESEND_API_KEY is missing"
        : "RESEND_FROM_EMAIL is missing";

    await markDeliveryFailed(
      supabase,
      deliveryId,
      message
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

  const typedReport =
    report as ReportRow;

  const email =
    buildReportEmail({
      businessName:
        business.name,

      reportUrl:
        reportsUrl(),

      scanDate:
        typedReport.scan_date,

      revenueAtRisk:
        numberValue(
          typedReport
            .revenue_at_risk
        ),

      estimatedRecovery:
        numberValue(
          typedReport
            .estimated_recovery
        ),

      recoveredAmount:
        numberValue(
          typedReport
            .recovered_amount
        ),

      leaksFound:
        numberValue(
          typedReport
            .leaks_found
        ),

      newLeaks:
        numberValue(
          typedReport
            .new_leaks
        ),

      resolvedLeaks:
        numberValue(
          typedReport
            .resolved_leaks
        ),

      revenueRiskChange:
        numberValue(
          typedReport
            .revenue_risk_change
        ),

      topLeaks:
        parseTopLeaks(
          typedReport
            .top_leaks
        ),
    });

  const resend =
    new Resend(
      resendKey
    );

  const {
    data,
    error,
  } =
    await resend.emails.send(
      {
        from,

        to: [
          claimed.recipient,
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
            claimed.report_id,
            claimed.recipient
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

    await markDeliveryFailed(
      supabase,
      deliveryId,
      message
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
    )
    .eq(
      "status",
      "processing"
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
