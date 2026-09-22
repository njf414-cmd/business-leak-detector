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
  
  function isSubstantialCompletionReached(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "achieved",
      "approved",
      "accepted",
      "substantially complete",
      "substantial completion",
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
  /* DETECTOR #54 */
  /* ================================== */
  
  export const unbilledSubstantialCompletionPaymentDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-substantial-completion-payment",
  
      name:
        "Unbilled Substantial Completion Payment",
  
      description:
        "Detects construction substantial-completion milestone payments that have been earned but have not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Substantial Completion Item",
          "Substantial Completion Amount",
          "Substantial Completion Status",
          "Substantial Completion Billing Status",
          "Substantial Completion Date",
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
              Substantial completion must
              explicitly be reached,
              accepted, approved, or
              otherwise ready to bill.
            */
  
            if (
              !isSubstantialCompletionReached(
                row[
                  "Substantial Completion Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              Already billed or collected
              substantial-completion payments
              are not revenue leaks.
            */
  
            if (
              isAlreadyBilled(
                row[
                  "Substantial Completion Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Substantial Completion Amount"
                ]
              );
  
            /*
              Require an explicit substantial
              completion payment amount.
  
              Never substitute Contract Amount,
              Project Receivable Amount,
              Retainage Amount, Closeout Amount,
              Invoice Amount, or another
              financial field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const completionItem =
              cleanText(
                row[
                  "Substantial Completion Item"
                ]
              );
  
            /*
              Require an explicit milestone
              item so we know what earned
              payment is being detected.
            */
  
            if (!completionItem) {
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
                  "Substantial Completion Date"
                ]
              );
  
            const recovery =
              amount * 0.9;
  
            leaks.push({
              detectorId:
                "construction.unbilled-substantial-completion-payment",
  
              leakType:
                "Unbilled Substantial Completion Payment",
  
              title:
                `${customerName} has an unbilled substantial completion payment`,
  
              description:
                `${customerName}'s ${completionItem}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(
                  2
                )} substantial completion payment that has not been billed.`,
  
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
  
                completionItem,
  
                completionAmount:
                  amount,
  
                completionStatus:
                  cleanText(
                    row[
                      "Substantial Completion Status"
                    ]
                  ),
  
                billingStatus:
                  cleanText(
                    row[
                      "Substantial Completion Billing Status"
                    ]
                  ),
  
                completionDate,
              },
  
              recommendedAction:
                `Review ${customerName}'s substantial completion milestone and invoice the documented $${amount.toFixed(
                  2
                )} earned payment.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "substantial_completion_payment",
  
                detectionReason:
                  "substantial_completion_reached_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-substantial-completion-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };