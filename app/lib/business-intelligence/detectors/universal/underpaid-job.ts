import type {
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
  } from "../../detector-types";
  
  /* ================================== */
  /* HELPERS */
  /* ================================== */
  
  function cleanText(
    value: unknown
  ): string {
    return String(value ?? "").trim();
  }
  
  function normalizeText(
    value: unknown
  ): string {
    return cleanText(value)
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }
  
  function hasValue(
    value: unknown
  ): boolean {
    if (
      value === null ||
      value === undefined
    ) {
      return false;
    }
  
    return (
      String(value).trim() !== ""
    );
  }
  
  function parseMoney(
    value: unknown
  ): number {
    const cleaned = cleanText(value)
      .replace(/[$,]/g, "")
      .replace(/[^\d.-]/g, "");
  
    const parsed = Number(cleaned);
  
    if (!Number.isFinite(parsed)) {
      return 0;
    }
  
    return Math.max(
      0,
      parsed
    );
  }
  
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
  
  function isCompletedJob(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "completed",
        "complete",
        "job completed",
        "work completed",
        "service completed",
        "finished",
        "done",
        "closed",
      ]
    );
  }
  
  function isDeadJob(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "cancelled",
        "canceled",
        "void",
        "voided",
        "refunded",
        "lost",
        "closed lost",
        "no show",
        "no-show",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const underpaidJobDetector:
    BusinessLeakDetector = {
      id:
        "universal.underpaid-job",
  
      name:
        "Underpaid Job",
  
      description:
        "Detects completed jobs where a recorded payment amount is lower than the recorded job value.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Job Status",
          "Job Amount",
          "Amount Paid",
          "Invoice Amount",
          "Payment Status",
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
  
            const jobStatus =
              cleanText(
                row["Job Status"]
              );
  
            /*
              Cancelled, lost, refunded,
              voided, or no-show work is
              handled by other detectors.
            */
  
            if (
              isDeadJob(status) ||
              isDeadJob(jobStatus)
            ) {
              return;
            }
  
            /*
              We only consider earned revenue
              after the job is clearly marked
              complete.
            */
  
            const completed =
              isCompletedJob(
                jobStatus
              ) ||
              isCompletedJob(
                status
              );
  
            if (!completed) {
              return;
            }
  
            /*
              A confirmed Underpaid Job needs
              an explicit job value.
            */
  
            if (
              !hasValue(
                row["Job Amount"]
              )
            ) {
              return;
            }
  
            const jobAmount =
              parseMoney(
                row["Job Amount"]
              );
  
            if (jobAmount <= 0) {
              return;
            }
  
            /*
              IMPORTANT SAFETY RULE:
  
              Missing Amount Paid does NOT
              mean $0 was paid.
  
              We only report a confirmed leak
              when the source data explicitly
              contains a payment amount.
            */
  
            if (
              !hasValue(
                row["Amount Paid"]
              )
            ) {
              return;
            }
  
            const amountPaid =
              parseMoney(
                row["Amount Paid"]
              );
  
            /*
              If the row contains a real
              invoice amount, invoice/payment
              detectors own the balance.
  
              This prevents Underpaid Job from
              independently describing the
              same invoice debt.
            */
  
            const invoiceAmount =
              parseMoney(
                row["Invoice Amount"]
              );
  
            if (invoiceAmount > 0) {
              return;
            }
  
            /*
              Fully paid or overpaid jobs are
              not leaks.
            */
  
            if (
              amountPaid >=
              jobAmount
            ) {
              return;
            }
  
            const remainingAmount =
              Math.max(
                0,
                jobAmount -
                  amountPaid
              );
  
            if (
              remainingAmount <= 0
            ) {
              return;
            }
  
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const paymentStatus =
              cleanText(
                row["Payment Status"]
              );
  
            leaks.push({
              detectorId:
                "universal.underpaid-job",
  
              leakType:
                "Underpaid Job",
  
              title:
                "Completed job not fully paid",
  
              description:
                `${customerName} has paid $${amountPaid.toFixed(
                  2
                )} of a $${jobAmount.toFixed(
                  2
                )} completed job, leaving $${remainingAmount.toFixed(
                  2
                )} uncollected.`,
  
              category:
                "Accounts Receivable",
  
              severity:
                remainingAmount >= 1000
                  ? "high"
                  : remainingAmount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                remainingAmount,
  
              estimatedRecovery:
                remainingAmount,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                jobStatus,
  
                paymentStatus,
  
                jobAmount,
  
                amountPaid,
  
                remainingAmount,
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Verify the final balance and contact the customer to collect the remaining amount owed for the completed work.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.underpaid-job",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };