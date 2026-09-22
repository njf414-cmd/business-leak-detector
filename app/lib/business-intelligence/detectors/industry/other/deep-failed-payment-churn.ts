import type {
  BusinessLeakDetector,
  DetectorContext,
  DetectorResult,
  DetectedBusinessLeak,
} from "../../../detector-types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: unknown): number | null {
  const cleaned = cleanText(value)
    .replace(/[$,%\s,]/g, "");

  if (
    !cleaned ||
    !/^-?\d+(\.\d+)?$/.test(cleaned)
  ) {
    return null;
  }

  const parsed =
    Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function compareNumbers(
  left: number,
  right: number,
  operator: string
): boolean {
  switch (operator) {
    case ">":
      return left > right;

    case ">=":
      return left >= right;

    case "<":
      return left < right;

    case "<=":
      return left <= right;

    case "=":
    case "==":
    case "===":
      return left === right;

    case "!=":
    case "!==":
      return left !== right;

    default:
      return false;
  }
}

function parseDate(
  value: unknown
): number | null {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  const parsed =
    Date.parse(text);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function ageInDays(
  value: unknown
): number | null {
  const date =
    parseDate(value);

  if (date === null) {
    return null;
  }

  return (
    Date.now() -
    date
  ) / 86400000;
}

function dateGapDays(
  startValue: unknown,
  endValue: unknown
): number | null {
  const start =
    parseDate(startValue);

  const end =
    parseDate(endValue);

  if (
    start === null ||
    end === null
  ) {
    return null;
  }

  return (
    end -
    start
  ) / 86400000;
}


function matchesRule(row: Record<string, unknown>): boolean {
  const value = parseNumber(
    row["Failed Payment Count"]
  );

  if (value === null) {
    return false;
  }

  return compareNumbers(
    value,
    1,
    ">"
  );
}


export const deepFailedPaymentChurnDetector: BusinessLeakDetector = {
  id: "deep.failed-payment-churn",
  name: "Failed Payment Churn",
  description: "Detects failed payment churn using documented business data and a threshold rule.",
  scope: "universal",
  industries: [],
  requirements: {
    requiredFields: ["Revenue Impact", "Failed Payment Count"],
    optionalFields: ["Customer Name", "Project Name", "Record"],
  },

  supports() {
    return true;
  },

  async detect(
    context: DetectorContext
  ): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach(
      (
        row,
        rowIndex
      ) => {
        if (
          !matchesRule(row)
        ) {
          return;
        }

        const amount =
          parseNumber(
            row[
              "Revenue Impact"
            ]
          );

        if (
          amount === null ||
          amount <= 0
        ) {
          return;
        }

        const item =
          cleanText(
            row[
              "Record"
            ]
          );

        if (!item) {
          return;
        }

        const customerName =
          cleanText(
            row[
              "Customer Name"
            ]
          ) ||
          "Unknown Customer";

        const projectName =
          cleanText(
            row[
              "Project Name"
            ]
          );

        const recovery =
          amount *
          0.9;

        leaks.push({
          detectorId:
            "deep.failed-payment-churn",

          leakType:
            "Failed Payment Churn",

          title:
            `${customerName} has a failed payment churn`,

          description:
            `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} triggered the threshold rule with a documented $${amount.toFixed(2)} revenue impact.`,

          category:
            "Retention & Churn",

          severity:
            amount >=
            25000
              ? "high"
              : amount >=
                7500
              ? "medium"
              : "low",

          confidence:
            "high",

          estimatedLoss:
            amount,

          estimatedRecovery:
            recovery,

          customerName,

          sourceRowIndex:
            rowIndex,

          evidence: {
            projectName,
            item,
            amount,
            ruleType:
              "threshold",
          },

          recommendedAction:
            `Review ${customerName}'s ${item} and address the documented $${amount.toFixed(2)} revenue impact.`,

          metadata: {
            scope:
              "universal",

            ruleType:
              "threshold",

            revenueType:
              "failed_payment_churn",

            detectionReason:
              "deep_failed_payment_churn",
          },
        });
      }
    );

    return {
      detectorId:
        "deep.failed-payment-churn",

      ran:
        true,

      leaks,
      warnings,
      errors,
    };
  },
};
