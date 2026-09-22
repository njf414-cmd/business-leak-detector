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
  
  function upsellRecommended(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "recommended",
      "offered",
      "proposed",
      "presented",
      "suggested",
      "upgrade recommended",
      "add on recommended",
    ].includes(status);
  }
  
  function upsellSold(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "sold",
      "approved",
      "accepted",
      "authorized",
      "purchased",
      "booked",
      "scheduled",
      "installed",
      "completed",
      "complete",
      "done",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #44 */
  /* ================================== */
  
  export const missedUpsellOpportunityDetector:
    BusinessLeakDetector = {
      id:
        "home-services.missed-upsell-opportunity",
  
      name:
        "Missed Upsell Opportunity",
  
      description:
        "Detects documented home-service upgrades or add-ons that were recommended to a customer but did not convert into a sale.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Upsell Item",
          "Upsell Recommendation Status",
          "Upsell Sale Status",
          "Upsell Amount",
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
              that an upsell or upgrade
              was actually recommended.
  
              We never invent possible
              upsells from the base job.
            */
  
            if (
              !upsellRecommended(
                row[
                  "Upsell Recommendation Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              If the customer already
              purchased or approved the
              upsell, there is no leak.
            */
  
            if (
              upsellSold(
                row[
                  "Upsell Sale Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Upsell Amount"
                ]
              );
  
            /*
              Require the explicit value
              of the upsell.
  
              Never substitute Job Amount,
              Estimate Amount, Replacement
              Amount, or another field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const upsellItem =
              cleanText(
                row[
                  "Upsell Item"
                ]
              );
  
            if (!upsellItem) {
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
              Upsells are documented sales
              opportunities, but conversion
              is not guaranteed.
            */
  
            const recovery =
              amount * 0.3;
  
            leaks.push({
              detectorId:
                "home-services.missed-upsell-opportunity",
  
              leakType:
                "Missed Upsell Opportunity",
  
              title:
                `${customerName} has an unsold ${upsellItem} opportunity`,
  
              description:
                `${customerName} was offered ${upsellItem} worth $${amount.toFixed(
                  2
                )}, but the documented upsell did not convert into a sale.`,
  
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
                upsellItem,
  
                upsellRecommendationStatus:
                  cleanText(
                    row[
                      "Upsell Recommendation Status"
                    ]
                  ),
  
                upsellSaleStatus:
                  cleanText(
                    row[
                      "Upsell Sale Status"
                    ]
                  ),
  
                upsellAmount:
                  amount,
              },
  
              recommendedAction:
                `Follow up with ${customerName} about the recommended ${upsellItem} and attempt to recover the $${amount.toFixed(
                  2
                )} upsell opportunity.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "upsell_opportunity",
  
                detectionReason:
                  "recommended_upsell_not_sold",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.missed-upsell-opportunity",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };