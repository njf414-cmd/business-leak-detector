import type {
    BusinessLeakDetector,
    DetectorContext,
    DetectorResult,
    DetectedBusinessLeak,
  } from "../../../detector-types";
  
  /* ================================== */
  /* HELPERS */
  /* ================================== */
  
  function cleanText(
    value: unknown
  ): string {
    return String(
      value ?? ""
    ).trim();
  }
  
  function normalizeText(
    value: unknown
  ): string {
    return cleanText(value)
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }
  
  function parseMoney(
    value: unknown
  ): number | null {
    const cleaned =
      cleanText(value)
        .replace(/[$,\s]/g, "");
  
    if (
      !cleaned ||
      !/^\d+(\.\d+)?$/.test(
        cleaned
      )
    ) {
      return null;
    }
  
    const parsed =
      Number(cleaned);
  
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }
  
  function isUnbilled(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "unbilled",
      "not billed",
      "not charged",
      "missed charge",
      "omitted",
      "left off invoice",
      "not invoiced",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #33 */
  /* ================================== */
  
  export const unbilledPartsLaborDetector:
    BusinessLeakDetector = {
      id:
        "automotive.unbilled-parts-labor",
  
      name:
        "Unbilled Parts or Labor",
  
      description:
        "Detects automotive parts or labor that were used or performed but explicitly left off the customer bill.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Unbilled Item",
          "Unbilled Type",
          "Unbilled Amount",
          "Unbilled Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "automotive"
        );
      },
  
      async detect(
        context: DetectorContext
      ): Promise<DetectorResult> {
        const leaks:
          DetectedBusinessLeak[] = [];
  
        const warnings:
          string[] = [];
  
        const errors:
          string[] = [];
  
        context.rows.forEach(
          (
            row,
            rowIndex
          ) => {
            const status =
              row[
                "Unbilled Status"
              ];
  
            /*
              Require explicit evidence that
              the charge was missed.
  
              We do not assume an item is
              unbilled from missing data.
            */
  
            if (
              !isUnbilled(status)
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Unbilled Amount"
                ]
              );
  
            /*
              Never estimate the value of
              missing parts or labor.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const item =
              cleanText(
                row[
                  "Unbilled Item"
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
  
            const itemType =
              cleanText(
                row[
                  "Unbilled Type"
                ]
              ) ||
              "part or labor";
  
            /*
              This is already identifiable
              revenue that was not billed,
              so the full amount is treated
              as recoverable opportunity.
            */
  
            const recovery =
              amount;
  
            leaks.push({
              detectorId:
                "automotive.unbilled-parts-labor",
  
              leakType:
                "Unbilled Parts or Labor",
  
              title:
                `${customerName} was not billed for ${item}`,
  
              description:
                `${item} (${itemType}) was left off ${customerName}'s bill, representing $${amount.toFixed(
                  2
                )} in unbilled revenue.`,
  
              category:
                "Automotive Revenue",
  
              severity:
                amount >= 1000
                  ? "high"
                  : amount >= 250
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
                unbilledItem:
                  item,
  
                unbilledType:
                  itemType,
  
                unbilledAmount:
                  amount,
  
                unbilledStatus:
                  cleanText(
                    status
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s invoice for the missing ${item} charge and determine whether the $${amount.toFixed(
                  2
                )} can still be billed or collected.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "unbilled_revenue",
  
                detectionReason:
                  "parts_or_labor_explicitly_unbilled",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.unbilled-parts-labor",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };