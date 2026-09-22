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
  
  function isRealServiceNeed(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "qualified",
      "service needed",
      "needs service",
      "emergency",
      "urgent",
      "repair needed",
      "appointment requested",
    ].includes(status);
  }
  
  function isConverted(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "booked",
      "scheduled",
      "converted",
      "won",
      "in progress",
      "completed",
      "complete",
      "done",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #38 */
  /* ================================== */
  
  export const unconvertedServiceCallDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unconverted-service-call",
  
      name:
        "Unconverted Service Call",
  
      description:
        "Detects qualified home-service calls with a documented service need and value that did not convert into a booked job.",
  
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
          "Booking Status",
          "Service Call Amount",
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
              The record must explicitly
              indicate a real service need.
  
              We do not treat every phone
              call as lost revenue.
            */
  
            if (
              !isRealServiceNeed(
                row[
                  "Service Call Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the opportunity already
              converted into work, there
              is no leak.
            */
  
            if (
              isConverted(
                row[
                  "Booking Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Service Call Amount"
                ]
              );
  
            /*
              Require an explicit monetary
              value for the opportunity.
  
              Never substitute Job Amount,
              Estimate Amount, or another
              unrelated field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const service =
              cleanText(
                row[
                  "Service"
                ]
              );
  
            if (!service) {
              return;
            }
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            /*
              This is a qualified service
              opportunity, but conversion
              is not guaranteed.
            */
  
            const recovery =
              amount * 0.4;
  
            leaks.push({
              detectorId:
                "home-services.unconverted-service-call",
  
              leakType:
                "Unconverted Service Call",
  
              title:
                `${customerName}'s ${service} call did not convert`,
  
              description:
                `${customerName} had a qualified service need for ${service} worth $${amount.toFixed(
                  2
                )}, but the opportunity did not convert into a booked job.`,
  
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
  
                serviceCallStatus:
                  cleanText(
                    row[
                      "Service Call Status"
                    ]
                  ),
  
                bookingStatus:
                  cleanText(
                    row[
                      "Booking Status"
                    ]
                  ),
  
                serviceCallAmount:
                  amount,
              },
  
              recommendedAction:
                `Contact ${customerName} about their ${service} request, identify why the call did not convert, and attempt to book the $${amount.toFixed(
                  2
                )} service opportunity.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "unconverted_service_call",
  
                detectionReason:
                  "qualified_service_call_not_converted",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unconverted-service-call",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };