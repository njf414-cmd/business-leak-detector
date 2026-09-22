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
  const left = parseNumber(
    row["Current Supplier Cost"]
  );

  const right = parseNumber(
    row["Pricing Cost Basis"]
  );

  if (left === null || right === null) {
    return false;
  }

  return compareNumbers(
    left,
    right,
    ">"
  );
}


export const deepSupplierIncreaseNotPassedThroughDetector: BusinessLeakDetector = {
  id: "deep.supplier-increase-not-passed-through",
  name: "Supplier Increase Not Passed Through",
  description: "Detects supplier increase not passed through using documented business data and a comparison rule.",
  scope: "universal",
  industries: [],
  requirements: {
    requiredFields: ["Revenue Impact", "Current Supplier Cost", "Pricing Cost Basis"],
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
            "deep.supplier-increase-not-passed-through",

          leakType:
            "Supplier Increase Not Passed Through",

          title:
            `${customerName} has a supplier increase not passed through`,

          description:
            `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} triggered the comparison rule with a documented $${amount.toFixed(2)} revenue impact.`,

          category:
            "Inventory & Materials",

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
              "comparison",
          },

          recommendedAction:
            `Review ${customerName}'s ${item} and address the documented $${amount.toFixed(2)} revenue impact.`,

          metadata: {
            scope:
              "universal",

            ruleType:
              "comparison",

            revenueType:
              "supplier_increase_not_passed_through",

            detectionReason:
              "deep_supplier_increase_not_passed_through",
          },
        });
      }
    );

    return {
      detectorId:
        "deep.supplier-increase-not-passed-through",

      ran:
        true,

      leaks,
      warnings,
      errors,
    };
  },
};
