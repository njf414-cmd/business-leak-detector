export type CustomerSetupMode =
  | "manual"
  | "ai"
  | "done_for_you";

export type CustomerOnboardingStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "paused";

export type CustomerDataStatus =
  | "not_connected"
  | "needs_mapping"
  | "ready"
  | "error";

export type CustomerReportFrequency =
  | "manual"
  | "weekly"
  | "biweekly"
  | "monthly";

export type CustomerAutomationSettings = {
  business_id: string;
  setup_mode: CustomerSetupMode;
  onboarding_status: CustomerOnboardingStatus;
  data_status: CustomerDataStatus;
  recurring_scans_enabled: boolean;
  report_frequency: CustomerReportFrequency;
  notifications_enabled: boolean;
  notification_email: string | null;
  timezone: string;
  next_scan_at: string | null;
  last_scan_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_CUSTOMER_AUTOMATION_SETTINGS = {
  setup_mode: "manual",
  onboarding_status: "not_started",
  data_status: "not_connected",
  recurring_scans_enabled: false,
  report_frequency: "manual",
  notifications_enabled: true,
  notification_email: null,
  timezone: "America/New_York",
  next_scan_at: null,
  last_scan_at: null,
  onboarding_completed_at: null,
} satisfies Omit<
  CustomerAutomationSettings,
  "business_id" | "created_at" | "updated_at"
>;

export function isCustomerAutomationReady(
  settings: Pick<
    CustomerAutomationSettings,
    "onboarding_status" | "data_status"
  >
): boolean {
  return (
    settings.onboarding_status === "ready" &&
    settings.data_status === "ready"
  );
}
