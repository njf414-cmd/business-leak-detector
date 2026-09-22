function envFlag(
  name: string,
  defaultValue: boolean
): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

function envNumber(
  name: string,
  defaultValue: number
): number {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : defaultValue;
}

export const appConfig = {
  environment:
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",

  limits: {
    maxUploadMb: envNumber(
      "MAX_UPLOAD_MB",
      10
    ),

    maxAnalysisRows: envNumber(
      "MAX_ANALYSIS_ROWS",
      10000
    ),
  },

  features: {
    analysis: envFlag(
      "FEATURE_ANALYSIS",
      true
    ),

    aiAnalysis: envFlag(
      "FEATURE_AI_ANALYSIS",
      false
    ),

    automatedRecovery: envFlag(
      "FEATURE_AUTOMATED_RECOVERY",
      false
    ),

    recurringScans: envFlag(
      "FEATURE_RECURRING_SCANS",
      false
    ),

    customerNotifications: envFlag(
      "FEATURE_CUSTOMER_NOTIFICATIONS",
      false
    ),

    aiSetup: envFlag(
      "FEATURE_AI_SETUP",
      false
    ),

    doneForYouSetup: envFlag(
      "FEATURE_DFY_SETUP",
      false
    ),

    experimentalDetectors: envFlag(
      "FEATURE_EXPERIMENTAL_DETECTORS",
      false
    ),
  },

  maintenance: {
    enabled: envFlag(
      "MAINTENANCE_MODE",
      false
    ),
  },
} as const;

export type AppConfig =
  typeof appConfig;
