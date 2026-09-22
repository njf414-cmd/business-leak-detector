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
  
  function replacementRecommended(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "recommended",
      "replacement recommended",
      "replace",
      "needs replacement",
      "replacement needed",
      "failed",
      "end of life",
    ].includes(status);
  }
  
  function replacementSold(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "sold",
      "approved",
      "accepted",
      "authorized",
      "booked",
      "scheduled",
      "in progress",
      "started",
      "completed",
      "complete",
      "done",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #43 */
  /* ================================== */
  
  export const unsoldReplacementOpportunityDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unsold-replacement-opportunity",
  
      name:
        "Unsold Replacement Opportunity",
  
      description:
        "Detects documented home-service equipment replacement recommendations with an explicit value that did not convert into sold work.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Replacement Item",
          "Replacement Recommendation Status",
          "Replacement Sale Status",
          "Replacement Amount",
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
              Require explicit evidence
              that replacement was
              recommended.
  
              We never infer replacement
              need from equipment age or
              another unrelated field.
            */
  
            if (
              !replacementRecommended(
                row[
                  "Replacement Recommendation Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the replacement already
              converted into sold or
              scheduled work, there is
              no leak.
            */
  
            if (
              replacementSold(
                row[
                  "Replacement Sale Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Replacement Amount"
                ]
              );
  
            /*
              Require an explicit
              replacement value.
  
              Never substitute Estimate
              Amount, Job Amount, Invoice
              Amount, or another field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const replacementItem =
              cleanText(
                row[
                  "Replacement Item"
                ]
              );
  
            if (!replacementItem) {
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
              Replacement opportunities
              can be high-value but are
              not guaranteed sales.
            */
  
            const recovery =
              amount * 0.3;
  
            leaks.push({
              detectorId:
                "home-services.unsold-replacement-opportunity",
  
              leakType:
                "Unsold Replacement Opportunity",
  
              title:
                `${customerName} has an unsold ${replacementItem} replacement`,
  
              description:
                `${customerName} was documented as needing ${replacementItem} replacement worth $${amount.toFixed(
                  2
                )}, but the opportunity did not convert into sold work.`,
  
              category:
                "Home Services Revenue",
  
              severity:
                amount >= 10000
                  ? "high"
                  : amount >= 3000
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
                replacementItem,
  
                replacementRecommendationStatus:
                  cleanText(
                    row[
                      "Replacement Recommendation Status"
                    ]
                  ),
  
                replacementSaleStatus:
                  cleanText(
                    row[
                      "Replacement Sale Status"
                    ]
                  ),
  
                replacementAmount:
                  amount,
              },
  
              recommendedAction:
                `Follow up with ${customerName} about the recommended ${replacementItem} replacement and attempt to recover the $${amount.toFixed(
                  2
                )} opportunity.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "replacement_opportunity",
  
                detectionReason:
                  "recommended_replacement_not_sold",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unsold-replacement-opportunity",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };