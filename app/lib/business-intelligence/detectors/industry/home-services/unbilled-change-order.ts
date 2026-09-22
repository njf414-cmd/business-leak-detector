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
  
  function changeOrderApproved(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "approved",
      "accepted",
      "authorized",
      "signed",
      "completed",
      "performed",
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
      "paid",
      "collected",
      "included",
      "added to invoice",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #40 */
  /* ================================== */
  
  export const unbilledChangeOrderDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unbilled-change-order",
  
      name:
        "Unbilled Change Order",
  
      description:
        "Detects approved home-service change orders with an explicit value that have not been billed to the customer.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Service",
          "Change Order",
          "Change Order Amount",
          "Change Order Status",
          "Change Order Billing Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "home_services"
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
              !changeOrderApproved(
                row[
                  "Change Order Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the extra work was already
              billed, invoiced, collected,
              or included elsewhere, there
              is no leak.
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
  
              Never infer it from the job,
              estimate, invoice, or other
              monetary fields.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const changeOrder =
              cleanText(
                row[
                  "Change Order"
                ]
              );
  
            const service =
              cleanText(
                row[
                  "Service"
                ]
              );
  
            const workDescription =
              changeOrder ||
              service ||
              "additional work";
  
            /*
              Approved/performed work that
              has not been billed is a
              strong recovery opportunity.
            */
  
            const recovery =
              amount * 0.85;
  
            leaks.push({
              detectorId:
                "home-services.unbilled-change-order",
  
              leakType:
                "Unbilled Change Order",
  
              title:
                `${customerName} has an unbilled change order`,
  
              description:
                `${customerName}'s ${workDescription} change order is worth $${amount.toFixed(
                  2
                )} and has not been billed.`,
  
              category:
                "Home Services Billing",
  
              severity:
                amount >= 5000
                  ? "high"
                  : amount >= 1000
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
                service,
  
                changeOrder:
                  cleanText(
                    row[
                      "Change Order"
                    ]
                  ),
  
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
                )} change order for ${workDescription} and add it to the customer's invoice if it is still unbilled.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "unbilled_change_order",
  
                detectionReason:
                  "approved_change_order_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unbilled-change-order",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };