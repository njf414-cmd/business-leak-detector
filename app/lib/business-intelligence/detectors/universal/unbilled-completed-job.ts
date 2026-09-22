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
  
    return String(value).trim() !== "";
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
  
  function isBilledStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "invoiced",
        "invoice sent",
        "billed",
        "bill sent",
        "billing complete",
        "billing completed",
        "paid",
        "partially paid",
        "partial payment",
        "payment failed",
        "failed",
        "overdue",
        "unpaid",
        "payment due",
        "yes",
        "true",
        "1",
      ]
    );
  }
  
  function isExplicitlyUnbilled(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "not invoiced",
        "uninvoiced",
        "unbilled",
        "not billed",
        "invoice not sent",
        "bill not sent",
        "pending invoice",
        "invoice pending",
        "needs invoice",
        "needs invoicing",
        "needs billing",
        "invoice needed",
        "billing needed",
        "no",
        "false",
        "0",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unbilledCompletedJobDetector:
    BusinessLeakDetector = {
      id:
        "universal.unbilled-completed-job",
  
      name:
        "Unbilled Completed Job",
  
      description:
        "Detects completed work with a known job value and explicit evidence that billing or invoicing has not occurred.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Job Status",
          "Job Amount",
          "Invoice Amount",
          "Billing Status",
          "Payment Status",
          "Amount Paid",
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
  
            const billingStatus =
              cleanText(
                row["Billing Status"]
              );
  
            const paymentStatus =
              cleanText(
                row["Payment Status"]
              );
  
            /*
              Cancelled/lost work belongs to
              the lost-revenue detector family.
            */
  
            if (
              isDeadJob(status) ||
              isDeadJob(jobStatus)
            ) {
              return;
            }
  
            /*
              Work must clearly be completed.
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
              A defensible leak requires a
              known positive job value.
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
              Existing invoice value means the
              job has already entered the
              invoice/payment process.
            */
  
            const invoiceAmount =
              parseMoney(
                row["Invoice Amount"]
              );
  
            if (invoiceAmount > 0) {
              return;
            }
  
            /*
              Recorded payment also means we
              should not classify the entire
              job as unbilled.
            */
  
            const amountPaid =
              parseMoney(
                row["Amount Paid"]
              );
  
            if (amountPaid > 0) {
              return;
            }
  
            /*
              Explicit evidence that billing
              already occurred overrides any
              conflicting unbilled signal.
            */
  
            if (
              isBilledStatus(
                billingStatus
              ) ||
              isBilledStatus(
                paymentStatus
              )
            ) {
              return;
            }
  
            /*
              SAFETY RULE:
  
              A blank Invoice Amount alone
              does NOT prove the job was never
              invoiced.
  
              We require an explicit unbilled
              signal.
  
              Billing Status is preferred,
              while Status / Job Status /
              Payment Status remain supported
              for databases that store the
              information there.
            */
  
            const explicitlyUnbilled =
              isExplicitlyUnbilled(
                billingStatus
              ) ||
              isExplicitlyUnbilled(
                paymentStatus
              ) ||
              isExplicitlyUnbilled(
                status
              ) ||
              isExplicitlyUnbilled(
                jobStatus
              );
  
            if (!explicitlyUnbilled) {
              return;
            }
  
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            leaks.push({
              detectorId:
                "universal.unbilled-completed-job",
  
              leakType:
                "Unbilled Completed Job",
  
              title:
                "Completed job has not been billed",
  
              description:
                `${customerName} has $${jobAmount.toFixed(
                  2
                )} of completed work with explicit evidence that billing has not occurred.`,
  
              category:
                "Billing",
  
              severity:
                jobAmount >= 1000
                  ? "high"
                  : jobAmount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                jobAmount,
  
              estimatedRecovery:
                jobAmount,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                jobStatus,
  
                billingStatus,
  
                paymentStatus,
  
                jobAmount,
  
                invoiceAmount,
  
                amountPaid,
  
                explicitlyUnbilled,
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Verify that no invoice exists, then create and send the customer an invoice for the completed work.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.unbilled-completed-job",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };