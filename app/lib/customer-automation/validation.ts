import type {
  CustomerDataStatus,
  CustomerOnboardingStatus,
  CustomerReportFrequency,
  CustomerSetupMode,
} from "./types";

export type CustomerAutomationPatch = {
  setup_mode?: CustomerSetupMode;
  onboarding_status?: CustomerOnboardingStatus;
  data_status?: CustomerDataStatus;
  recurring_scans_enabled?: boolean;
  report_frequency?: CustomerReportFrequency;
  notifications_enabled?: boolean;
  notification_email?: string | null;
  timezone?: string;
};

type ParseResult =
  | { ok: true; value: CustomerAutomationPatch }
  | { ok: false; error: string };

const setupModes = new Set<CustomerSetupMode>([
  "manual",
  "ai",
  "done_for_you",
]);

const onboardingStatuses = new Set<CustomerOnboardingStatus>([
  "not_started",
  "in_progress",
  "ready",
  "paused",
]);

const dataStatuses = new Set<CustomerDataStatus>([
  "not_connected",
  "needs_mapping",
  "ready",
  "error",
]);

const reportFrequencies = new Set<CustomerReportFrequency>([
  "manual",
  "weekly",
  "biweekly",
  "monthly",
]);

const allowedKeys = new Set<keyof CustomerAutomationPatch>([
  "setup_mode",
  "onboarding_status",
  "data_status",
  "recurring_scans_enabled",
  "report_frequency",
  "notifications_enabled",
  "notification_email",
  "timezone",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function parseCustomerAutomationPatch(
  input: unknown
): ParseResult {
  if (!isRecord(input)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const keys = Object.keys(input);

  if (keys.length === 0) {
    return { ok: false, error: "At least one setting is required." };
  }

  const unknownKey = keys.find(
    (key) => !allowedKeys.has(key as keyof CustomerAutomationPatch)
  );

  if (unknownKey) {
    return {
      ok: false,
      error: `Setting "${unknownKey}" cannot be changed here.`,
    };
  }

  const value: CustomerAutomationPatch = {};

  if ("setup_mode" in input) {
    if (
      typeof input.setup_mode !== "string" ||
      !setupModes.has(input.setup_mode as CustomerSetupMode)
    ) {
      return { ok: false, error: "Invalid setup_mode." };
    }
    value.setup_mode = input.setup_mode as CustomerSetupMode;
  }

  if ("onboarding_status" in input) {
    if (
      typeof input.onboarding_status !== "string" ||
      !onboardingStatuses.has(
        input.onboarding_status as CustomerOnboardingStatus
      )
    ) {
      return { ok: false, error: "Invalid onboarding_status." };
    }
    value.onboarding_status =
      input.onboarding_status as CustomerOnboardingStatus;
  }

  if ("data_status" in input) {
    if (
      typeof input.data_status !== "string" ||
      !dataStatuses.has(input.data_status as CustomerDataStatus)
    ) {
      return { ok: false, error: "Invalid data_status." };
    }
    value.data_status = input.data_status as CustomerDataStatus;
  }

  if ("recurring_scans_enabled" in input) {
    if (typeof input.recurring_scans_enabled !== "boolean") {
      return {
        ok: false,
        error: "recurring_scans_enabled must be true or false.",
      };
    }
    value.recurring_scans_enabled = input.recurring_scans_enabled;
  }

  if ("report_frequency" in input) {
    if (
      typeof input.report_frequency !== "string" ||
      !reportFrequencies.has(
        input.report_frequency as CustomerReportFrequency
      )
    ) {
      return { ok: false, error: "Invalid report_frequency." };
    }
    value.report_frequency =
      input.report_frequency as CustomerReportFrequency;
  }

  if ("notifications_enabled" in input) {
    if (typeof input.notifications_enabled !== "boolean") {
      return {
        ok: false,
        error: "notifications_enabled must be true or false.",
      };
    }
    value.notifications_enabled = input.notifications_enabled;
  }

  if ("notification_email" in input) {
    if (input.notification_email === null) {
      value.notification_email = null;
    } else if (typeof input.notification_email === "string") {
      const email = input.notification_email.trim();

      if (
        email.length === 0 ||
        email.length > 254 ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
      ) {
        return { ok: false, error: "Invalid notification_email." };
      }

      value.notification_email = email;
    } else {
      return {
        ok: false,
        error: "notification_email must be an email address or null.",
      };
    }
  }

  if ("timezone" in input) {
    if (typeof input.timezone !== "string") {
      return { ok: false, error: "timezone must be a string." };
    }

    const timezone = input.timezone.trim();

    if (timezone.length === 0 || timezone.length > 100) {
      return { ok: false, error: "Invalid timezone." };
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    } catch {
      return { ok: false, error: "Invalid timezone." };
    }

    value.timezone = timezone;
  }

  return { ok: true, value };
}
