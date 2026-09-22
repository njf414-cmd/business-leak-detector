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
  
  function milestoneCompleted(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "approved",
      "finished",
      "done",
      "verified",
    ].includes(status);
  }
  
  function progressPaymentBilled(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "billed",
      "invoiced",
      "paid",
      "collected",
      "submitted",
      "included",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #46 */
  /* ================================== */
  
  export const unbilledProgressPaymentDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-progress-payment",
  
      name:
        "Unbilled Progress Payment",
  
      description:
        "Detects completed construction milestones with an explicit progress-payment amount that has not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Project Milestone",
          "Milestone Status",
          "Progress Payment Amount",
          "Progress Payment Status",
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
              that the project milestone
              has been completed.
            */
  
            if (
              !milestoneCompleted(
                row[
                  "Milestone Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the progress payment has
              already been billed,
              submitted, or collected,
              there is no leak.
            */
  
            if (
              progressPaymentBilled(
                row[
                  "Progress Payment Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Progress Payment Amount"
                ]
              );
  
            /*
              Require an explicit progress
              payment amount.
  
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
  
            const milestone =
              cleanText(
                row[
                  "Project Milestone"
                ]
              );
  
            if (!milestone) {
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
              Completed contractual work
              that has not been billed is
              a strong recovery
              opportunity.
            */
  
            const recovery =
              amount * 0.9;
  
            leaks.push({
              detectorId:
                "construction.unbilled-progress-payment",
  
              leakType:
                "Unbilled Progress Payment",
  
              title:
                `${customerName} has an unbilled progress payment`,
  
              description:
                `${customerName}'s ${milestone}${projectLabel} is complete, but the $${amount.toFixed(
                  2
                )} progress payment has not been billed.`,
  
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
  
                projectMilestone:
                  milestone,
  
                milestoneStatus:
                  cleanText(
                    row[
                      "Milestone Status"
                    ]
                  ),
  
                progressPaymentAmount:
                  amount,
  
                progressPaymentStatus:
                  cleanText(
                    row[
                      "Progress Payment Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s completed ${milestone}${projectLabel} and issue the outstanding $${amount.toFixed(
                  2
                )} progress invoice if it is still unbilled.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "progress_payment",
  
                detectionReason:
                  "completed_milestone_payment_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-progress-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };