import type {
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
  } from "../../detector-types";
  
  /* ================================== */
  /* BASIC HELPERS */
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
  ): number {
    const cleaned =
      cleanText(value)
        .replace(/[$,]/g, "")
        .replace(
          /[^\d.-]/g,
          ""
        );
  
    const parsed =
      Number(cleaned);
  
    if (
      !Number.isFinite(parsed)
    ) {
      return 0;
    }
  
    return Math.max(
      0,
      parsed
    );
  }
  
  /* ================================== */
  /* STATUS HELPERS */
  /* ================================== */
  
  function matchesStatus(
    value: unknown,
    statuses: string[]
  ): boolean {
    const normalized =
      normalizeText(value);
  
    return statuses.some(
      (status) =>
        normalized ===
        normalizeText(status)
    );
  }
  
  function isNoShowStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "no show",
        "no-show",
        "noshow",
        "missed appointment",
        "did not show",
        "customer no show",
        "customer no-show",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const noShowDetector:
    BusinessLeakDetector = {
      id:
        "universal.no-show",
  
      name:
        "No-Show",
  
      description:
        "Detects scheduled appointments or jobs where the customer failed to show up, causing lost revenue.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Appointment Status",
          "Job Status",
          "Job Amount",
          "Quote Amount",
          "Date",
        ],
      },
  
      supports() {
        return true;
      },
  
      detect(
        context: DetectorContext
      ) {
        const leaks:
          DetectedBusinessLeak[] = [];
  
        const warnings:
          string[] = [];
  
        const errors:
          string[] = [];
  
        context.rows.forEach(
          (row, rowIndex) => {
            const status =
              cleanText(
                row["Status"]
              );
  
            const appointmentStatus =
              cleanText(
                row[
                  "Appointment Status"
                ]
              );
  
            const jobStatus =
              cleanText(
                row["Job Status"]
              );
  
            /*
              Match the legacy detector.
  
              A No-Show can be identified from
              the general status, appointment
              status, or job status.
            */
  
            const noShow =
              isNoShowStatus(
                status
              ) ||
              isNoShowStatus(
                appointmentStatus
              ) ||
              isNoShowStatus(
                jobStatus
              );
  
            if (!noShow) {
              return;
            }
  
            /*
              Prefer Job Amount because this
              represents the actual scheduled
              revenue.
  
              Fall back to Quote Amount when
              no job amount exists.
            */
  
            const jobAmount =
              parseMoney(
                row[
                  "Job Amount"
                ]
              );
  
            const quoteAmount =
              parseMoney(
                row[
                  "Quote Amount"
                ]
              );
  
            const amount =
              jobAmount > 0
                ? jobAmount
                : quoteAmount;
  
            if (amount <= 0) {
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
              No-Show is lost revenue in the
              legacy engine.
  
              Recovery rate = 0%.
            */
  
            const severity =
              amount >= 1500
                ? "high"
                : amount >= 750
                  ? "medium"
                  : "low";
  
            leaks.push({
              detectorId:
                "universal.no-show",
  
              leakType:
                "No-Show",
  
              title:
                "Lost revenue from no-show",
  
              description:
                `${customerName} did not show for a scheduled appointment or job worth $${amount.toFixed(
                  2
                )}.`,
  
              category:
                "Lost",
  
              severity,
  
              confidence:
                "high",
  
              estimatedLoss:
                amount,
  
              estimatedRecovery:
                0,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                appointmentStatus,
  
                jobStatus,
  
                jobAmount,
  
                quoteAmount,
  
                lostRevenue:
                  amount,
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Review the no-show, contact the customer if appropriate, and consider rescheduling or improving appointment reminder procedures.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.no-show",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };