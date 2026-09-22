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
  
  function isPunchListComplete(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "approved",
      "accepted",
      "signed off",
      "punch list complete",
      "punchlist complete",
      "ready to bill",
    ].includes(status);
  }
  
  function isAlreadyBilled(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "billed",
      "invoiced",
      "invoice sent",
      "paid",
      "collected",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #55 */
  /* ================================== */
  
  export const unbilledPunchListPaymentDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-punch-list-payment",
  
      name:
        "Unbilled Punch List Completion Payment",
  
      description:
        "Detects completed construction punch-list work with an earned payment that has not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Punch List Item",
          "Punch List Amount",
          "Punch List Status",
          "Punch List Billing Status",
          "Punch List Completion Date",
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
              Punch-list work must explicitly
              be complete, approved, accepted,
              signed off, or ready to bill.
            */
  
            if (
              !isPunchListComplete(
                row[
                  "Punch List Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              Already billed or collected
              punch-list payments are not
              revenue leaks.
            */
  
            if (
              isAlreadyBilled(
                row[
                  "Punch List Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Punch List Amount"
                ]
              );
  
            /*
              Require an explicit punch-list
              payment amount.
  
              Never substitute Contract Amount,
              Closeout Amount,
              Substantial Completion Amount,
              Retainage Amount,
              Invoice Amount,
              or another financial field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const punchListItem =
              cleanText(
                row[
                  "Punch List Item"
                ]
              );
  
            /*
              Require an explicit punch-list
              item so we know what completed
              work the payment belongs to.
            */
  
            if (!punchListItem) {
              return;
            }
  
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const projectName =
              cleanText(
                row["Project Name"]
              );
  
            const completionDate =
              cleanText(
                row[
                  "Punch List Completion Date"
                ]
              );
  
            const recovery =
              amount * 0.9;
  
            leaks.push({
              detectorId:
                "construction.unbilled-punch-list-payment",
  
              leakType:
                "Unbilled Punch List Completion Payment",
  
              title:
                `${customerName} has an unbilled punch-list completion payment`,
  
              description:
                `${customerName}'s ${punchListItem}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(
                  2
                )} punch-list payment that has not been billed.`,
  
              category:
                "Construction Billing",
  
              severity:
                amount >= 25000
                  ? "high"
                  : amount >= 7500
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
  
                punchListItem,
  
                punchListAmount:
                  amount,
  
                punchListStatus:
                  cleanText(
                    row[
                      "Punch List Status"
                    ]
                  ),
  
                billingStatus:
                  cleanText(
                    row[
                      "Punch List Billing Status"
                    ]
                  ),
  
                completionDate,
              },
  
              recommendedAction:
                `Review ${customerName}'s completed punch-list work and invoice the documented $${amount.toFixed(
                  2
                )} earned payment.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "punch_list_payment",
  
                detectionReason:
                  "completed_punch_list_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-punch-list-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };