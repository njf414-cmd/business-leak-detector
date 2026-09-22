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
  
  function isScheduledOrCompleted(
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
  /* DETECTOR #37 */
  /* ================================== */
  
  export const unscheduledMaintenanceDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unscheduled-maintenance",
  
      name:
        "Unscheduled Maintenance",
  
      description:
        "Detects home-service customers whose documented maintenance or follow-up service is due but has not been scheduled.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Maintenance Service",
          "Maintenance Due Date",
          "Maintenance Amount",
          "Maintenance Status",
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
            const dueDate =
              parseDate(
                row[
                  "Maintenance Due Date"
                ]
              );
  
            /*
              We require an explicit due
              date. The detector never
              guesses when maintenance
              should occur.
            */
  
            if (!dueDate) {
              return;
            }
  
            /*
              #37 is for maintenance that
              is already due.
  
              Future maintenance is not
              treated as lost revenue yet.
            */
  
            if (
              dueDate.getTime() >
              context.now.getTime()
            ) {
              return;
            }
  
            /*
              If the maintenance is already
              scheduled, underway, or
              completed, there is no leak.
            */
  
            if (
              isScheduledOrCompleted(
                row[
                  "Maintenance Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Maintenance Amount"
                ]
              );
  
            /*
              Require an explicit value.
              Never substitute Job Amount,
              Invoice Amount, or another
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
                  "Maintenance Service"
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
  
            const daysOverdue =
              Math.max(
                0,
                daysBetween(
                  dueDate,
                  context.now
                )
              );
  
            const recovery =
              amount * 0.4;
  
            leaks.push({
              detectorId:
                "home-services.unscheduled-maintenance",
  
              leakType:
                "Unscheduled Maintenance",
  
              title:
                `${customerName} has unscheduled ${service}`,
  
              description:
                `${customerName}'s ${service} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue and has not been scheduled, representing $${amount.toFixed(
                  2
                )} in potential service revenue.`,
  
              category:
                "Home Services Retention",
  
              severity:
                daysOverdue >= 90 ||
                amount >= 2500
                  ? "high"
                  : daysOverdue >= 30 ||
                      amount >= 750
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
                maintenanceService:
                  service,
  
                maintenanceDueDate:
                  dueDate.toISOString(),
  
                maintenanceAmount:
                  amount,
  
                maintenanceStatus:
                  cleanText(
                    row[
                      "Maintenance Status"
                    ]
                  ),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Contact ${customerName} to schedule the overdue ${service} and recover the $${amount.toFixed(
                  2
                )} service opportunity.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "maintenance_reactivation",
  
                detectionReason:
                  "maintenance_due_without_scheduled_service",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unscheduled-maintenance",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };