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
  
  function parsePositiveNumber(
    value: unknown
  ): number | null {
    const cleaned =
      cleanText(value);
  
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
  
    if (
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      return null;
    }
  
    return parsed;
  }
  
  /* ================================== */
  /* DETECTOR #34 */
  /* ================================== */
  
  export const underchargedLaborDetector:
    BusinessLeakDetector = {
      id:
        "automotive.undercharged-labor",
  
      name:
        "Undercharged Labor",
  
      description:
        "Detects automotive jobs where the labor amount charged was lower than the documented labor amount that should have been billed.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Labor Description",
          "Labor Hours",
          "Labor Rate",
          "Labor Charged",
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
            const laborHours =
              parsePositiveNumber(
                row[
                  "Labor Hours"
                ]
              );
  
            const laborRate =
              parseMoney(
                row[
                  "Labor Rate"
                ]
              );
  
            const laborCharged =
              parseMoney(
                row[
                  "Labor Charged"
                ]
              );
  
            /*
              Require all three values.
  
              We never guess labor hours,
              labor rate, or the amount
              actually charged.
            */
  
            if (
              laborHours === null ||
              laborRate === null ||
              laborRate <= 0 ||
              laborCharged === null ||
              laborCharged < 0
            ) {
              return;
            }
  
            const expectedLabor =
              laborHours *
              laborRate;
  
            /*
              No leak exists if the shop
              charged the correct amount
              or more.
            */
  
            if (
              laborCharged >=
              expectedLabor
            ) {
              return;
            }
  
            const undercharge =
              expectedLabor -
              laborCharged;
  
            /*
              Ignore tiny floating-point
              differences.
            */
  
            if (
              undercharge < 0.01
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
  
            const laborDescription =
              cleanText(
                row[
                  "Labor Description"
                ]
              ) ||
              "labor";
  
            leaks.push({
              detectorId:
                "automotive.undercharged-labor",
  
              leakType:
                "Undercharged Labor",
  
              title:
                `${customerName} was undercharged for ${laborDescription}`,
  
              description:
                `${laborHours} labor hour${laborHours === 1 ? "" : "s"} at $${laborRate.toFixed(
                  2
                )}/hr should have produced $${expectedLabor.toFixed(
                  2
                )} in labor revenue, but ${customerName} was charged $${laborCharged.toFixed(
                  2
                )}, leaving a $${undercharge.toFixed(
                  2
                )} undercharge.`,
  
              category:
                "Automotive Margin",
  
              severity:
                undercharge >= 1000
                  ? "high"
                  : undercharge >= 250
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                undercharge,
  
              estimatedRecovery:
                undercharge,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                laborDescription,
  
                laborHours,
  
                laborRate,
  
                expectedLabor:
                  Number(
                    expectedLabor.toFixed(
                      2
                    )
                  ),
  
                laborCharged,
  
                undercharge:
                  Number(
                    undercharge.toFixed(
                      2
                    )
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s invoice for ${laborDescription}. The documented labor calculates to $${expectedLabor.toFixed(
                  2
                )}, leaving $${undercharge.toFixed(
                  2
                )} potentially uncollected.`,
              
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "labor_undercharge",
  
                detectionReason:
                  "labor_charged_below_documented_hours_times_rate",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.undercharged-labor",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };