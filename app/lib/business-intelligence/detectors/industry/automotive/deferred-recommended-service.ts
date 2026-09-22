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
  
  function isDeferred(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "deferred",
      "customer deferred",
      "deferred service",
      "service deferred",
      "postponed",
      "customer postponed",
      "later",
      "do later",
      "next visit",
      "future visit",
      "reschedule",
      "rescheduled",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #28 */
  /* ================================== */
  
  export const deferredRecommendedServiceDetector:
    BusinessLeakDetector = {
      id:
        "automotive.deferred-recommended-service",
  
      name:
        "Deferred Recommended Service",
  
      description:
        "Detects automotive service recommendations that the customer postponed or deferred to a future visit.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Recommended Service",
          "Recommended Service Amount",
          "Recommended Service Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "automotive"
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
            const status =
              row[
                "Recommended Service Status"
              ];
  
            /*
              This detector requires an
              explicit deferred/postponed
              status.
            */
  
            if (
              !isDeferred(
                status
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Recommended Service Amount"
                ]
              );
  
            /*
              Never estimate missing revenue.
  
              We need an explicit positive
              recommended-service amount.
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
                  "Recommended Service"
                ]
              ) ||
              "recommended service";
  
            /*
              Deferred work is generally a
              stronger recovery opportunity
              than explicitly declined work
              because the customer has already
              indicated possible future intent.
  
              Still, we do not assume the
              entire opportunity will recover.
            */
  
            const recovery =
              amount * 0.4;
  
            leaks.push({
              detectorId:
                "automotive.deferred-recommended-service",
  
              leakType:
                "Deferred Recommended Service",
  
              title:
                `${customerName} deferred ${service}`,
  
              description:
                `${customerName} deferred a recommended ${service} worth $${amount.toFixed(
                  2
                )}.`,
  
              category:
                "Automotive Revenue",
  
              severity:
                amount >= 1500
                  ? "high"
                  : amount >= 500
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
                recommendedService:
                  service,
  
                recommendedServiceAmount:
                  amount,
  
                recommendedServiceStatus:
                  cleanText(
                    status
                  ),
              },
  
              recommendedAction:
                `Follow up with ${customerName} about the deferred ${service} and offer a convenient appointment to complete the recommended work.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "service_opportunity",
  
                detectionReason:
                  "recommended_service_explicitly_deferred",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.deferred-recommended-service",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };