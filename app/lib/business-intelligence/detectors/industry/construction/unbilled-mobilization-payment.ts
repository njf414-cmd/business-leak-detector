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
  
  function isMobilizationEarned(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "mobilized",
      "performed",
      "approved",
      "earned",
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
  /* DETECTOR #52 */
  /* ================================== */
  
  export const unbilledMobilizationPaymentDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-mobilization-payment",
  
      name:
        "Unbilled Mobilization Payment",
  
      description:
        "Detects earned construction mobilization payments with documented billable amounts that have not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Mobilization",
          "Mobilization Amount",
          "Mobilization Status",
          "Mobilization Billing Status",
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
              Mobilization must explicitly
              be completed, earned, approved,
              or otherwise ready to bill.
            */
  
            if (
              !isMobilizationEarned(
                row[
                  "Mobilization Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              Already billed, invoiced,
              paid, or collected payments
              are not leaks.
            */
  
            if (
              isAlreadyBilled(
                row[
                  "Mobilization Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Mobilization Amount"
                ]
              );
  
            /*
              Require an explicit
              mobilization amount.
  
              Never substitute Contract
              Amount, Job Amount, Invoice
              Amount, Deposit Amount, or
              another financial field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const mobilization =
              cleanText(
                row["Mobilization"]
              );
  
            /*
              Require explicit information
              identifying the mobilization
              work/payment.
            */
  
            if (!mobilization) {
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
                "construction.unbilled-mobilization-payment",
  
              leakType:
                "Unbilled Mobilization Payment",
  
              title:
                `${customerName} has an unbilled mobilization payment`,
  
              description:
                `${customerName}'s ${mobilization}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(
                  2
                )} mobilization payment that has not been billed.`,
  
              category:
                "Construction Billing",
  
              severity:
                amount >= 20000
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
  
                mobilization,
  
                mobilizationAmount:
                  amount,
  
                mobilizationStatus:
                  cleanText(
                    row[
                      "Mobilization Status"
                    ]
                  ),
  
                billingStatus:
                  cleanText(
                    row[
                      "Mobilization Billing Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s mobilization billing and invoice the documented $${amount.toFixed(
                  2
                )} earned mobilization payment.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "mobilization_payment",
  
                detectionReason:
                  "earned_mobilization_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-mobilization-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };