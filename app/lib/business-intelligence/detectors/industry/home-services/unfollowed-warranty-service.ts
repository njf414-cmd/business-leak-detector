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
  
  function warrantyHandled(
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
      "resolved",
      "closed",
      "done",
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
  /* DETECTOR #42 */
  /* ================================== */
  
  export const unfollowedWarrantyServiceDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unfollowed-warranty-service",
  
      name:
        "Unfollowed Warranty Service",
  
      description:
        "Detects documented home-service warranty follow-ups that are due but have not been scheduled, resolved, or completed.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Warranty Service",
          "Warranty Follow Up Date",
          "Warranty Service Value",
          "Warranty Status",
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
            const followUpDate =
              parseDate(
                row[
                  "Warranty Follow Up Date"
                ]
              );
  
            /*
              Require an explicit warranty
              follow-up date.
  
              Never guess when warranty
              service should occur.
            */
  
            if (!followUpDate) {
              return;
            }
  
            /*
              Only detect warranty service
              that is already due.
  
              Future warranty follow-ups
              are not leaks yet.
            */
  
            if (
              followUpDate.getTime() >
              context.now.getTime()
            ) {
              return;
            }
  
            /*
              If the warranty work is
              already scheduled, underway,
              resolved, or completed,
              there is no leak.
            */
  
            if (
              warrantyHandled(
                row[
                  "Warranty Status"
                ]
              )
            ) {
              return;
            }
  
            const value =
              parseMoney(
                row[
                  "Warranty Service Value"
                ]
              );
  
            /*
              Require an explicit value.
  
              Never substitute Job Amount,
              Invoice Amount, Estimate
              Amount, or another field.
            */
  
            if (
              value === null ||
              value <= 0
            ) {
              return;
            }
  
            const warrantyService =
              cleanText(
                row[
                  "Warranty Service"
                ]
              );
  
            if (!warrantyService) {
              return;
            }
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const daysOverdue =
              Math.max(
                0,
                daysBetween(
                  followUpDate,
                  context.now
                )
              );
  
            /*
              Warranty work is different
              from direct new revenue.
  
              The estimated loss represents
              the documented value at risk
              from an unresolved warranty
              obligation/customer issue.
            */
  
            const recovery =
              value * 0.5;
  
            leaks.push({
              detectorId:
                "home-services.unfollowed-warranty-service",
  
              leakType:
                "Unfollowed Warranty Service",
  
              title:
                `${customerName} has overdue warranty service`,
  
              description:
                `${customerName}'s ${warrantyService} warranty follow-up is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue and remains unresolved, with $${value.toFixed(
                  2
                )} in documented service value at risk.`,
  
              category:
                "Home Services Retention",
  
              severity:
                daysOverdue >= 60 ||
                value >= 2500
                  ? "high"
                  : daysOverdue >= 21 ||
                      value >= 750
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                value,
  
              estimatedRecovery:
                recovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                warrantyService,
  
                warrantyFollowUpDate:
                  followUpDate.toISOString(),
  
                warrantyServiceValue:
                  value,
  
                warrantyStatus:
                  cleanText(
                    row[
                      "Warranty Status"
                    ]
                  ),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Contact ${customerName} and schedule or resolve the overdue ${warrantyService} warranty follow-up.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "warranty_retention",
  
                detectionReason:
                  "warranty_follow_up_due_unresolved",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unfollowed-warranty-service",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };