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
  /* DATE HELPERS */
  /* ================================== */
  
  function parseDate(
    value: unknown
  ): Date | null {
    const cleaned =
      cleanText(value);
  
    if (!cleaned) {
      return null;
    }
  
    const isoDateOnly =
      cleaned.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
      );
  
    if (isoDateOnly) {
      const year =
        Number(isoDateOnly[1]);
  
      const month =
        Number(isoDateOnly[2]);
  
      const day =
        Number(isoDateOnly[3]);
  
      const parsed =
        new Date(
          year,
          month - 1,
          day
        );
  
      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return parsed;
      }
  
      return null;
    }
  
    const parsed =
      new Date(cleaned);
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function isPastDue(
    value: unknown,
    now: Date
  ): boolean {
    const date =
      parseDate(value);
  
    if (!date) {
      return false;
    }
  
    const dueDate =
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
  
    const today =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
  
    return (
      dueDate.getTime() <
      today.getTime()
    );
  }
  
  function getDaysOverdue(
    value: unknown,
    now: Date
  ): number | null {
    const date =
      parseDate(value);
  
    if (!date) {
      return null;
    }
  
    const dueDate =
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
  
    const today =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
  
    const difference =
      today.getTime() -
      dueDate.getTime();
  
    if (difference <= 0) {
      return null;
    }
  
    return Math.floor(
      difference /
        (
          1000 *
          60 *
          60 *
          24
        )
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
  
  function isPaidStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "paid",
        "paid in full",
        "payment received",
        "settled",
        "collected",
        "complete payment",
      ]
    );
  }
  
  function isClosedStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "closed",
        "closed lost",
        "lost",
        "cancelled",
        "canceled",
        "completed",
        "complete",
        "finished",
        "done",
        "void",
        "voided",
        "refunded",
      ]
    );
  }
  
  function isOverdueStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "overdue",
        "past due",
        "past-due",
        "late",
        "delinquent",
      ]
    );
  }
  
  function isFailedPaymentStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "failed",
        "payment failed",
        "failed payment",
        "declined",
        "payment declined",
        "card declined",
        "charge failed",
        "transaction failed",
        "retry payment",
      ]
    );
  }
  
  function isPartialPaymentStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "partial",
        "partially paid",
        "partial payment",
        "part paid",
        "partially collected",
        "balance remaining",
        "remaining balance",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const overdueInvoiceDetector:
    BusinessLeakDetector = {
      id:
        "universal.overdue-invoice",
  
      name:
        "Overdue Invoice",
  
      description:
        "Detects unpaid invoice revenue that has passed its payment deadline.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        requiredFields: [
          "Invoice Amount",
        ],
  
        optionalFields: [
          "Customer Name",
          "Status",
          "Payment Status",
          "Amount Paid",
          "Due Date",
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
  
            const paymentStatus =
              cleanText(
                row[
                  "Payment Status"
                ]
              );
  
            /*
              Paid invoices are not leaks.
            */
  
            if (
              isPaidStatus(status) ||
              isPaidStatus(
                paymentStatus
              )
            ) {
              return;
            }
  
            /*
              Match legacy payment behavior:
              closed records are not active
              payment leaks.
            */
  
            if (
              isClosedStatus(status)
            ) {
              return;
            }
  
            const invoiceAmount =
              parseMoney(
                row[
                  "Invoice Amount"
                ]
              );
  
            if (
              invoiceAmount <= 0
            ) {
              return;
            }
  
            const amountPaid =
              parseMoney(
                row[
                  "Amount Paid"
                ]
              );
  
            /*
              Partial Payment has the highest
              payment-family priority.
  
              Leave partial records for that
              detector.
            */
  
            const partial =
              isPartialPaymentStatus(
                status
              ) ||
              isPartialPaymentStatus(
                paymentStatus
              ) ||
              (
                amountPaid > 0 &&
                amountPaid <
                  invoiceAmount
              );
  
            if (partial) {
              return;
            }
  
            /*
              Failed Payment has higher priority
              than Overdue Invoice.
            */
  
            const failed =
              isFailedPaymentStatus(
                status
              ) ||
              isFailedPaymentStatus(
                paymentStatus
              );
  
            if (failed) {
              return;
            }
  
            const dueDate =
              row["Due Date"];
  
            /*
              Legacy behavior:
  
              An invoice is overdue if either
              its status explicitly says so OR
              its due date has passed.
            */
  
            const explicitlyOverdue =
              isOverdueStatus(
                status
              ) ||
              isOverdueStatus(
                paymentStatus
              );
  
            const dateOverdue =
              isPastDue(
                dueDate,
                context.now
              );
  
            if (
              !explicitlyOverdue &&
              !dateOverdue
            ) {
              return;
            }
  
            const daysOverdue =
              getDaysOverdue(
                dueDate,
                context.now
              );
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const severity =
              invoiceAmount >=
              1000
                ? "high"
                : invoiceAmount >=
                    500
                  ? "medium"
                  : "low";
  
            /*
              Legacy Overdue Invoice
              recovery rate = 100%.
            */
  
            leaks.push({
              detectorId:
                "universal.overdue-invoice",
  
              leakType:
                "Overdue Invoice",
  
              title:
                "Overdue invoice revenue",
  
              description:
                daysOverdue !== null
                  ? `${customerName} has $${invoiceAmount.toFixed(
                      2
                    )} in overdue invoice revenue that is ${daysOverdue} days past due.`
                  : `${customerName} has $${invoiceAmount.toFixed(
                      2
                    )} in overdue invoice revenue.`,
  
              category:
                "Accounts Receivable",
  
              severity,
  
              confidence:
                "high",
  
              estimatedLoss:
                invoiceAmount,
  
              estimatedRecovery:
                invoiceAmount,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                paymentStatus,
  
                invoiceAmount,
  
                amountPaid,
  
                dueDate:
                  cleanText(
                    dueDate
                  ),
  
                explicitlyOverdue,
  
                dateOverdue,
  
                daysOverdue,
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Contact the customer about the overdue balance and send a payment reminder or request immediate payment.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.overdue-invoice",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };