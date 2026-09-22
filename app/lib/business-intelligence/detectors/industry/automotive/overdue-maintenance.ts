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
  
  function isCompletedStatus(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "performed",
      "done",
      "serviced",
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
  /* DETECTOR #29 */
  /* ================================== */
  
  export const overdueMaintenanceDetector:
    BusinessLeakDetector = {
      id:
        "automotive.overdue-maintenance",
  
      name:
        "Overdue Maintenance",
  
      description:
        "Detects automotive maintenance or service that is past its scheduled due date and has not been completed.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Maintenance Service",
          "Maintenance Amount",
          "Maintenance Due Date",
          "Maintenance Status",
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
            const dueDate =
              parseDate(
                row[
                  "Maintenance Due Date"
                ]
              );
  
            /*
              A valid due date is required.
  
              We do not infer maintenance
              schedules or manufacture dates
              that are not present in the
              customer's data.
            */
  
            if (!dueDate) {
              return;
            }
  
            /*
              Future or today-due maintenance
              is not overdue.
            */
  
            if (
              dueDate.getTime() >=
              context.now.getTime()
            ) {
              return;
            }
  
            /*
              Completed maintenance must never
              be reported as overdue.
            */
  
            const status =
              row[
                "Maintenance Status"
              ];
  
            if (
              isCompletedStatus(
                status
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
              Never invent revenue.
  
              Without a positive explicit
              maintenance amount, we do not
              create a financial leak.
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
                  "Maintenance Service"
                ]
              ) ||
              "scheduled maintenance";
  
            const daysOverdue =
              Math.max(
                1,
                daysBetween(
                  dueDate,
                  context.now
                )
              );
  
            /*
              Scheduled maintenance with an
              explicit overdue date represents
              a strong rebooking opportunity.
  
              Recovery remains conservative.
            */
  
            const recovery =
              amount * 0.45;
  
            leaks.push({
              detectorId:
                "automotive.overdue-maintenance",
  
              leakType:
                "Overdue Maintenance",
  
              title:
                `${customerName} is overdue for ${service}`,
  
              description:
                `${customerName} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue for ${service}, representing $${amount.toFixed(
                  2
                )} in potential service revenue.`,
  
              category:
                "Automotive Revenue",
  
              severity:
                daysOverdue >= 90 ||
                amount >= 1500
                  ? "high"
                  : daysOverdue >= 30 ||
                      amount >= 500
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
  
                maintenanceAmount:
                  amount,
  
                maintenanceDueDate:
                  dueDate.toISOString(),
  
                maintenanceStatus:
                  cleanText(
                    status
                  ),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Contact ${customerName} about the overdue ${service} and offer an appointment to complete the maintenance.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "maintenance_opportunity",
  
                detectionReason:
                  "scheduled_maintenance_past_due",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.overdue-maintenance",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };