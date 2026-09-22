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
  
  function isCloseoutComplete(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "approved",
      "accepted",
      "closed out",
      "closeout complete",
      "final approved",
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
  /* DETECTOR #53 */
  /* ================================== */
  
  export const unbilledCloseoutPaymentDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-closeout-payment",
  
      name:
        "Unbilled Closeout Payment",
  
      description:
        "Detects documented construction closeout or final payments that are earned but have not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Closeout Item",
          "Closeout Amount",
          "Closeout Status",
          "Closeout Billing Status",
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
              Closeout must explicitly be
              complete, accepted, approved,
              or otherwise ready to bill.
            */
  
            if (
              !isCloseoutComplete(
                row["Closeout Status"]
              )
            ) {
              return;
            }
  
            /*
              Already billed or collected
              closeout payments are not
              revenue leaks.
            */
  
            if (
              isAlreadyBilled(
                row[
                  "Closeout Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Closeout Amount"
                ]
              );
  
            /*
              Require an explicit closeout
              payment amount.
  
              Never substitute Contract
              Amount, Project Receivable
              Amount, Retainage Amount,
              Invoice Amount, or another
              financial field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const closeoutItem =
              cleanText(
                row["Closeout Item"]
              );
  
            /*
              Require an explicit closeout
              item so we know what earned
              payment is being detected.
            */
  
            if (!closeoutItem) {
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
  
            const recovery =
              amount * 0.9;
  
            leaks.push({
              detectorId:
                "construction.unbilled-closeout-payment",
  
              leakType:
                "Unbilled Closeout Payment",
  
              title:
                `${customerName} has an unbilled closeout payment`,
  
              description:
                `${customerName}'s ${closeoutItem}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(
                  2
                )} closeout payment that has not been billed.`,
  
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
  
                closeoutItem,
  
                closeoutAmount:
                  amount,
  
                closeoutStatus:
                  cleanText(
                    row[
                      "Closeout Status"
                    ]
                  ),
  
                billingStatus:
                  cleanText(
                    row[
                      "Closeout Billing Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s project closeout and invoice the documented $${amount.toFixed(
                  2
                )} earned closeout payment.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "closeout_payment",
  
                detectionReason:
                  "completed_closeout_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-closeout-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };