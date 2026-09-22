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
  
  function isDeclined(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "declined",
      "customer declined",
      "declined service",
      "service declined",
      "recommended service declined",
      "customer refused",
      "refused",
      "not authorized",
      "customer declined service",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const declinedRecommendedServiceDetector:
    BusinessLeakDetector = {
      id:
        "automotive.declined-recommended-service",
  
      name:
        "Declined Recommended Service",
  
      description:
        "Detects automotive service recommendations that were explicitly declined by the customer.",
  
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
              EXPLICIT decline.
  
              Missing, pending or merely
              recommended services belong to
              other detectors.
            */
  
            if (
              !isDeclined(
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
              Never invent revenue.
  
              Without an explicit positive
              recommended-service value,
              there is no financial leak to
              report.
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
  
            const recovery =
              amount * 0.3;
  
            leaks.push({
              detectorId:
                "automotive.declined-recommended-service",
  
              leakType:
                "Declined Recommended Service",
  
              title:
                `${customerName} declined ${service}`,
  
              description:
                `${customerName} declined a recommended ${service} worth $${amount.toFixed(
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
  
              /*
                This is opportunity revenue,
                not money already owed.
  
                Use a conservative recovery
                estimate rather than assuming
                the entire recommendation
                will be recovered.
              */
  
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
                `Follow up with ${customerName} about the declined ${service}, explain why the service was recommended, and offer a convenient appointment to reconsider the work.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "service_opportunity",
  
                detectionReason:
                  "recommended_service_explicitly_declined",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.declined-recommended-service",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };