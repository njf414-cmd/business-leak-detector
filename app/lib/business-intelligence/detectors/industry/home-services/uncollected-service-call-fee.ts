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
  
  function serviceCallOccurred(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "performed",
      "visited",
      "diagnosed",
      "finished",
      "done",
    ].includes(status);
  }
  
  function feeCollected(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "paid",
      "collected",
      "received",
      "waived",
      "included",
      "not applicable",
      "n/a",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #39 */
  /* ================================== */
  
  export const uncollectedServiceCallFeeDetector:
    BusinessLeakDetector = {
      id:
        "home-services.uncollected-service-call-fee",
  
      name:
        "Uncollected Service Call Fee",
  
      description:
        "Detects completed home-service visits with an explicit diagnostic or service-call fee that was not collected.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Service",
          "Service Call Status",
          "Service Call Fee",
          "Service Call Fee Status",
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
              A service visit must have
              explicitly occurred.
  
              We do not assume a fee is
              owed from an inquiry,
              cancelled call, or lead.
            */
  
            if (
              !serviceCallOccurred(
                row[
                  "Service Call Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the fee was collected,
              waived, included elsewhere,
              or not applicable, there
              is no leak.
            */
  
            if (
              feeCollected(
                row[
                  "Service Call Fee Status"
                ]
              )
            ) {
              return;
            }
  
            const fee =
              parseMoney(
                row[
                  "Service Call Fee"
                ]
              );
  
            /*
              Require the actual service
              call fee.
  
              Never infer it from the job,
              invoice, estimate, or other
              monetary fields.
            */
  
            if (
              fee === null ||
              fee <= 0
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
              "service call";
  
            /*
              Because this is an explicit
              fee that should already have
              been collected, recovery is
              estimated higher than a new
              sales opportunity.
            */
  
            const recovery =
              fee * 0.8;
  
            leaks.push({
              detectorId:
                "home-services.uncollected-service-call-fee",
  
              leakType:
                "Uncollected Service Call Fee",
  
              title:
                `${customerName} has an uncollected service-call fee`,
  
              description:
                `${customerName}'s completed ${service} has a $${fee.toFixed(
                  2
                )} diagnostic or service-call fee that has not been collected.`,
  
              category:
                "Home Services Billing",
  
              severity:
                fee >= 500
                  ? "high"
                  : fee >= 200
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                fee,
  
              estimatedRecovery:
                recovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                service,
  
                serviceCallStatus:
                  cleanText(
                    row[
                      "Service Call Status"
                    ]
                  ),
  
                serviceCallFee:
                  fee,
  
                serviceCallFeeStatus:
                  cleanText(
                    row[
                      "Service Call Fee Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s completed ${service} and collect the outstanding $${fee.toFixed(
                  2
                )} service-call fee if it is still owed.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "uncollected_service_fee",
  
                detectionReason:
                  "completed_service_call_fee_not_collected",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.uncollected-service-call-fee",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };