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
  
  function isCancelledJobStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "cancelled",
        "canceled",
        "cancelled job",
        "canceled job",
        "job cancelled",
        "job canceled",
        "cancelled appointment",
        "canceled appointment",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const cancelledJobDetector:
    BusinessLeakDetector = {
      id:
        "universal.cancelled-job",
  
      name:
        "Cancelled Job",
  
      description:
        "Detects cancelled jobs or appointments that resulted in lost revenue.",
  
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
              Match cancellation states from
              the general status, appointment
              status, or job status.
            */
  
            const cancelled =
              isCancelledJobStatus(
                status
              ) ||
              isCancelledJobStatus(
                appointmentStatus
              ) ||
              isCancelledJobStatus(
                jobStatus
              );
  
            if (!cancelled) {
              return;
            }
  
            /*
              Prefer actual Job Amount.
  
              If unavailable, use Quote Amount
              as the value of the lost job.
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
              Cancelled Job is categorized as
              lost revenue by the legacy engine.
  
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
                "universal.cancelled-job",
  
              leakType:
                "Cancelled Job",
  
              title:
                "Lost revenue from cancelled job",
  
              description:
                `${customerName} had a job or appointment worth $${amount.toFixed(
                  2
                )} cancelled.`,
  
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
                "Review why the job was cancelled and use the cancellation pattern to improve retention, scheduling, deposits, or customer follow-up.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.cancelled-job",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };