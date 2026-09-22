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
  
  function isUnsold(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "unsold",
      "not sold",
      "not approved",
      "not authorized",
      "pending",
      "open",
      "recommended",
      "recommendation",
      "needs follow up",
      "follow up",
    ].includes(status);
  }
  
  function isSoldOrCompleted(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "sold",
      "approved",
      "authorized",
      "completed",
      "complete",
      "performed",
      "done",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #31 */
  /* ================================== */
  
  export const unsoldInspectionRecommendationDetector:
    BusinessLeakDetector = {
      id:
        "automotive.unsold-inspection-recommendation",
  
      name:
        "Unsold Inspection Recommendation",
  
      description:
        "Detects automotive repair or maintenance opportunities identified during an inspection that were not sold or completed.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Inspection Recommendation",
          "Inspection Recommendation Amount",
          "Inspection Recommendation Status",
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
                "Inspection Recommendation Status"
              ];
  
            /*
              We require an explicit unsold
              status.
  
              This prevents the detector from
              assuming that a recommendation
              was lost simply because data is
              missing.
            */
  
            if (
              !isUnsold(status)
            ) {
              return;
            }
  
            if (
              isSoldOrCompleted(
                status
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Inspection Recommendation Amount"
                ]
              );
  
            /*
              Never estimate or invent the
              value of the recommendation.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const recommendation =
              cleanText(
                row[
                  "Inspection Recommendation"
                ]
              );
  
            /*
              There must be an actual
              inspection recommendation.
            */
  
            if (!recommendation) {
              return;
            }
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const recovery =
              amount * 0.3;
  
            leaks.push({
              detectorId:
                "automotive.unsold-inspection-recommendation",
  
              leakType:
                "Unsold Inspection Recommendation",
  
              title:
                `${customerName} has an unsold ${recommendation} recommendation`,
  
              description:
                `${customerName} has an inspection recommendation for ${recommendation} worth $${amount.toFixed(
                  2
                )} that has not been sold or completed.`,
  
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
                inspectionRecommendation:
                  recommendation,
  
                inspectionRecommendationAmount:
                  amount,
  
                inspectionRecommendationStatus:
                  cleanText(
                    status
                  ),
              },
  
              recommendedAction:
                `Follow up with ${customerName} about the ${recommendation} found during their inspection, explain why the work was recommended, and offer an appointment to complete it.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "inspection_opportunity",
  
                detectionReason:
                  "inspection_recommendation_not_sold",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.unsold-inspection-recommendation",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };