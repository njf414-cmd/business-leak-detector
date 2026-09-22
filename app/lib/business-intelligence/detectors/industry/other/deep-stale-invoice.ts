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
  const daysOld = ageInDays(
    row["Invoice Date"]
  );

  if (daysOld === null) {
    return false;
  }

  return compareNumbers(
    daysOld,
    45,
    ">"
  );
}


export const deepStaleInvoiceDetector: BusinessLeakDetector = {
  id: "deep.stale-invoice",
  name: "Stale Invoice",
  description: "Detects stale invoice using documented business data and a age rule.",
  scope: "universal",
  industries: [],
  requirements: {
    requiredFields: ["Revenue Impact", "Invoice Date"],
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
            "deep.stale-invoice",

          leakType:
            "Stale Invoice",

          title:
            `${customerName} has a stale invoice`,

          description:
            `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} triggered the age rule with a documented $${amount.toFixed(2)} revenue impact.`,

          category:
            "Collections & Cash Flow",

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
              "age",
          },

          recommendedAction:
            `Review ${customerName}'s ${item} and address the documented $${amount.toFixed(2)} revenue impact.`,

          metadata: {
            scope:
              "universal",

            ruleType:
              "age",

            revenueType:
              "stale_invoice",

            detectionReason:
              "deep_stale_invoice",
          },
        });
      }
    );

    return {
      detectorId:
        "deep.stale-invoice",

      ran:
        true,

      leaks,
      warnings,
      errors,
    };
  },
};
