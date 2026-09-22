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
  
  function changeOrderEarned(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "approved",
      "accepted",
      "authorized",
      "signed",
      "performed",
      "completed",
      "complete",
      "done",
    ].includes(status);
  }
  
  function changeOrderBilled(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "billed",
      "invoiced",
      "submitted",
      "paid",
      "collected",
      "included",
      "added to invoice",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #47 */
  /* ================================== */
  
  export const constructionUnbilledChangeOrderDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-change-order",
  
      name:
        "Unbilled Change Order",
  
      description:
        "Detects approved or performed construction change orders with an explicit value that have not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Change Order",
          "Change Order Amount",
          "Change Order Status",
          "Change Order Billing Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "construction"
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
            /*
              Require explicit evidence
              that the change order was
              approved or performed.
            */
  
            if (
              !changeOrderEarned(
                row[
                  "Change Order Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the change order was
              already billed, submitted,
              included, or collected,
              there is no leak.
            */
  
            if (
              changeOrderBilled(
                row[
                  "Change Order Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Change Order Amount"
                ]
              );
  
            /*
              Require the explicit change
              order value.
  
              Never substitute Contract
              Amount, Job Amount, Invoice
              Amount, or another field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const changeOrder =
              cleanText(
                row[
                  "Change Order"
                ]
              );
  
            if (!changeOrder) {
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
  
            const projectLabel =
              projectName
                ? ` on ${projectName}`
                : "";
  
            /*
              Approved/performed change
              orders are strong billing
              recovery opportunities.
            */
  
            const recovery =
              amount * 0.85;
  
            leaks.push({
              detectorId:
                "construction.unbilled-change-order",
  
              leakType:
                "Unbilled Change Order",
  
              title:
                `${customerName} has an unbilled change order`,
  
              description:
                `${customerName}'s ${changeOrder}${projectLabel} is worth $${amount.toFixed(
                  2
                )} and has not been billed.`,
  
              category:
                "Construction Billing",
  
              severity:
                amount >= 25000
                  ? "high"
                  : amount >= 5000
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
  
                changeOrder,
  
                changeOrderAmount:
                  amount,
  
                changeOrderStatus:
                  cleanText(
                    row[
                      "Change Order Status"
                    ]
                  ),
  
                changeOrderBillingStatus:
                  cleanText(
                    row[
                      "Change Order Billing Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s $${amount.toFixed(
                  2
                )} change order for ${changeOrder}${projectLabel} and issue the outstanding invoice if it is still unbilled.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "change_order",
  
                detectionReason:
                  "approved_change_order_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-change-order",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };