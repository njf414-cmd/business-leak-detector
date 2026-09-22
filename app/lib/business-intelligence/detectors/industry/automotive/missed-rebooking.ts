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
  
  function hasAppointment(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "booked",
      "scheduled",
      "confirmed",
      "appointment booked",
      "appointment scheduled",
    ].includes(status);
  }
  
  function daysBetween(
    earlier: Date,
    later: Date
  ): number {
    const milliseconds =
      later.getTime() -
      earlier.getTime();
  
    return Math.ceil(
      milliseconds /
        (1000 * 60 * 60 * 24)
    );
  }
  
  /* ================================== */
  /* DETECTOR #35 */
  /* ================================== */
  
  export const missedRebookingDetector:
    BusinessLeakDetector = {
      id:
        "automotive.missed-rebooking",
  
      name:
        "Missed Rebooking",
  
      description:
        "Detects upcoming automotive service opportunities where a customer has a documented next-service date but no appointment has been booked.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Next Service",
          "Next Service Date",
          "Next Service Amount",
          "Next Appointment Status",
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
            const nextServiceDate =
              parseDate(
                row[
                  "Next Service Date"
                ]
              );
  
            /*
              A real next-service date must
              exist. We never invent when
              the customer should return.
            */
  
            if (!nextServiceDate) {
              return;
            }
  
            /*
              #35 focuses on UPCOMING
              rebooking opportunities.
  
              Overdue return opportunities
              belong to #30 instead.
            */
  
            if (
              nextServiceDate.getTime() <
              context.now.getTime()
            ) {
              return;
            }
  
            const appointmentStatus =
              row[
                "Next Appointment Status"
              ];
  
            /*
              If the customer already has an
              appointment, there is no missed
              rebooking opportunity.
            */
  
            if (
              hasAppointment(
                appointmentStatus
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Next Service Amount"
                ]
              );
  
            /*
              Never invent the value of the
              future service opportunity.
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
                  "Next Service"
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
  
            const daysUntilService =
              Math.max(
                0,
                daysBetween(
                  context.now,
                  nextServiceDate
                )
              );
  
            /*
              This is a future retention
              opportunity, so recovery is
              intentionally conservative.
            */
  
            const recovery =
              amount * 0.35;
  
            leaks.push({
              detectorId:
                "automotive.missed-rebooking",
  
              leakType:
                "Missed Rebooking",
  
              title:
                `${customerName} has not booked ${service}`,
  
              description:
                `${customerName} is expected back for ${service} in ${daysUntilService} day${daysUntilService === 1 ? "" : "s"}, but no appointment is currently booked, representing $${amount.toFixed(
                  2
                )} in potential service revenue.`,
  
              category:
                "Automotive Retention",
  
              severity:
                amount >= 1500
                  ? "high"
                  : daysUntilService <= 14 ||
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
                nextService:
                  service,
  
                nextServiceDate:
                  nextServiceDate.toISOString(),
  
                nextServiceAmount:
                  amount,
  
                nextAppointmentStatus:
                  cleanText(
                    appointmentStatus
                  ),
  
                daysUntilService,
              },
  
              recommendedAction:
                `Contact ${customerName} before their upcoming ${service} is due and offer to schedule the next appointment.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "rebooking_opportunity",
  
                detectionReason:
                  "upcoming_service_without_booked_appointment",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.missed-rebooking",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };