import type {
  BusinessLeakDetector,
  DetectorContext,
  DetectorResult,
  DetectedBusinessLeak,
} from "../../../detector-types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
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

export const deepDuplicatePurchasingDetector: BusinessLeakDetector = {
  id: "deep.duplicate-purchasing",
  name: "Duplicate Purchasing",
  description: "Detects duplicate purchasing using documented business data and a aggregate rule.",
  scope: "universal",
  industries: [],
  requirements: {
    requiredFields: ["Revenue Impact", "Purchase Item", "Purchase Count"],
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

    const groups =
      new Map<
        string,
        {
          total: number;
          amount: number;
          firstRowIndex: number;
        }
      >();

    context.rows.forEach(
      (
        row,
        rowIndex
      ) => {
        const groupName =
          cleanText(
            row[
              "Purchase Item"
            ]
          );

        if (!groupName) {
          return;
        }

        const aggregateValue =
          parseNumber(
            row[
              "Purchase Count"
            ]
          );

        if (
          aggregateValue === null
        ) {
          return;
        }

        const amount =
          parseNumber(
            row[
              "Revenue Impact"
            ]
          ) ?? 0;

        const current =
          groups.get(
            groupName
          ) || {
            total: 0,
            amount: 0,
            firstRowIndex:
              rowIndex,
          };

        current.total +=
          aggregateValue;

        current.amount +=
          amount;

        groups.set(
          groupName,
          current
        );
      }
    );

    for (
      const [
        groupName,
        values,
      ]
      of groups.entries()
    ) {
      if (
        !compareNumbers(
          values.total,
          1,
          ">"
        )
      ) {
        continue;
      }

      const amount =
        values.amount > 0
          ? values.amount
          : Math.abs(
              values.total
            );

      if (
        amount <= 0
      ) {
        continue;
      }

      const recovery =
        amount *
        0.9;

      leaks.push({
        detectorId:
          "deep.duplicate-purchasing",

        leakType:
          "Duplicate Purchasing",

        title:
          `${groupName} has a duplicate purchasing`,

        description:
          `${groupName} triggered the aggregate rule with an aggregate value of ${values.total.toFixed(2)} and a documented $${amount.toFixed(2)} revenue impact.`,

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

        customerName:
          groupName,

        sourceRowIndex:
          values.firstRowIndex,

        evidence: {
          group:
            groupName,

          aggregateValue:
            values.total,

          threshold:
            1,

          operator:
            ">",

          ruleType:
            "aggregate",
        },

        recommendedAction:
          `Review ${groupName} and address the detected aggregate revenue leak.`,

        metadata: {
          scope:
            "universal",

          ruleType:
            "aggregate",

          revenueType:
            "duplicate_purchasing",

          detectionReason:
            "deep_duplicate_purchasing",
        },
      });
    }

    return {
      detectorId:
        "deep.duplicate-purchasing",

      ran:
        true,

      leaks,
      warnings,
      errors,
    };
  },
};
