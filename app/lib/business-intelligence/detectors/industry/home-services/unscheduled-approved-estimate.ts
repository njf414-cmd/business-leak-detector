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
  
  function isApproved(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "approved",
      "accepted",
      "authorized",
      "signed",
      "won",
    ].includes(status);
  }
  
  function isScheduled(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "scheduled",
      "booked",
      "confirmed",
      "in progress",
      "started",
      "completed",
      "complete",
      "done",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #36 */
  /* ================================== */
  
  export const unscheduledApprovedEstimateDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unscheduled-approved-estimate",
  
      name:
        "Unscheduled Approved Estimate",
  
      description:
        "Detects approved home-service estimates that have not been scheduled for work.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Service",
          "Estimate Amount",
          "Estimate Status",
          "Job Status",
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
              The estimate must explicitly
              show customer approval.
            */
  
            if (
              !isApproved(
                row[
                  "Estimate Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the job is already booked,
              underway, or completed, there
              is no scheduling leak.
            */
  
            if (
              isScheduled(
                row[
                  "Job Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Estimate Amount"
                ]
              );
  
            /*
              Never invent the value of
              the approved opportunity.
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
  
            const service =
              cleanText(
                row[
                  "Service"
                ]
              ) ||
              "approved service";
  
            /*
              Because the customer already
              approved the estimate, this is
              a high-intent recovery
              opportunity.
            */
  
            const recovery =
              amount * 0.6;
  
            leaks.push({
              detectorId:
                "home-services.unscheduled-approved-estimate",
  
              leakType:
                "Unscheduled Approved Estimate",
  
              title:
                `${customerName}'s approved ${service} has not been scheduled`,
  
              description:
                `${customerName} approved ${service} worth $${amount.toFixed(
                  2
                )}, but the work has not been scheduled.`,
  
              category:
                "Home Services Revenue",
  
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
  
                estimateAmount:
                  amount,
  
                estimateStatus:
                  cleanText(
                    row[
                      "Estimate Status"
                    ]
                  ),
  
                jobStatus:
                  cleanText(
                    row[
                      "Job Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Contact ${customerName} to schedule the approved ${service} and secure the $${amount.toFixed(
                  2
                )} job.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "approved_unscheduled_work",
  
                detectionReason:
                  "approved_estimate_without_scheduled_job",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unscheduled-approved-estimate",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };