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
  
  function parseDate(
    value: unknown
  ): Date | null {
    const text =
      cleanText(value);
  
    if (!text) {
      return null;
    }
  
    const parsed =
      new Date(text);
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function retainageCollected(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "paid",
      "collected",
      "received",
      "released",
      "processed",
      "complete",
      "completed",
    ].includes(status);
  }
  
  function daysBetween(
    earlier: Date,
    later: Date
  ): number {
    const milliseconds =
      later.getTime() -
      earlier.getTime();
  
    return Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    );
  }
  
  /* ================================== */
  /* DETECTOR #48 */
  /* ================================== */
  
  export const uncollectedRetainageDetector:
    BusinessLeakDetector = {
      id:
        "construction.uncollected-retainage",
  
      name:
        "Uncollected Retainage",
  
      description:
        "Detects construction retainage with an explicit amount and release date that is already due but has not been collected.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Retainage Amount",
          "Retainage Release Date",
          "Retainage Status",
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
            const releaseDate =
              parseDate(
                row[
                  "Retainage Release Date"
                ]
              );
  
            /*
              Require an explicit release
              date.
  
              Never guess when retainage
              becomes collectible.
            */
  
            if (!releaseDate) {
              return;
            }
  
            /*
              Future retainage is not a
              revenue leak yet.
            */
  
            if (
              releaseDate.getTime() >
              context.now.getTime()
            ) {
              return;
            }
  
            /*
              If retainage has already
              been collected or released,
              there is no leak.
            */
  
            if (
              retainageCollected(
                row[
                  "Retainage Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Retainage Amount"
                ]
              );
  
            /*
              Require the explicit
              retainage amount.
  
              Never calculate it from a
              contract percentage or use
              another monetary field.
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
  
            const projectName =
              cleanText(
                row[
                  "Project Name"
                ]
              );
  
            const projectLabel =
              projectName
                ? ` for ${projectName}`
                : "";
  
            const daysOverdue =
              Math.max(
                0,
                daysBetween(
                  releaseDate,
                  context.now
                )
              );
  
            /*
              Retainage that is explicitly
              due represents earned money,
              so recovery probability is
              relatively strong.
            */
  
            const recovery =
              amount * 0.9;
  
            leaks.push({
              detectorId:
                "construction.uncollected-retainage",
  
              leakType:
                "Uncollected Retainage",
  
              title:
                `${customerName} has uncollected retainage`,
  
              description:
                `${customerName}'s $${amount.toFixed(
                  2
                )} retainage${projectLabel} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past its documented release date and has not been collected.`,
  
              category:
                "Construction Billing",
  
              severity:
                amount >= 25000 ||
                daysOverdue >= 90
                  ? "high"
                  : amount >= 5000 ||
                      daysOverdue >= 30
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
  
                retainageAmount:
                  amount,
  
                retainageReleaseDate:
                  releaseDate.toISOString(),
  
                retainageStatus:
                  cleanText(
                    row[
                      "Retainage Status"
                    ]
                  ),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Review ${customerName}'s $${amount.toFixed(
                  2
                )} retainage${projectLabel} and begin collection or release follow-up if the balance is still outstanding.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "retainage",
  
                detectionReason:
                  "retainage_due_not_collected",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.uncollected-retainage",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };