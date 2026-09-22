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
  
  export const failedPaymentDetector:
    BusinessLeakDetector = {
      id:
        "universal.failed-payment",
  
      name:
        "Failed Payment",
  
      description:
        "Detects failed or declined payments where invoice revenue is still recoverable.",
  
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
              Paid records cannot be
              failed-payment leaks.
            */
  
            if (
              isPaidStatus(
                status
              ) ||
              isPaidStatus(
                paymentStatus
              )
            ) {
              return;
            }
  
            /*
              Match legacy payment logic:
              closed records are not active
              payment leaks.
            */
  
            if (
              isClosedStatus(
                status
              )
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
              Partial Payment has higher
              payment-family priority.
  
              If the row proves that only part
              of the invoice was paid, leave it
              for Partial Payment.
            */
  
            const statusPartial =
              isPartialPaymentStatus(
                status
              ) ||
              isPartialPaymentStatus(
                paymentStatus
              );
  
            const amountPartial =
              amountPaid > 0 &&
              amountPaid <
                invoiceAmount;
  
            if (
              statusPartial ||
              amountPartial
            ) {
              return;
            }
  
            /*
              Failed Payment requires an
              explicit failed/declined status.
            */
  
            const failed =
              isFailedPaymentStatus(
                status
              ) ||
              isFailedPaymentStatus(
                paymentStatus
              );
  
            if (!failed) {
              return;
            }
  
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
              Legacy Failed Payment recovery
              rate = 90%.
            */
  
            const estimatedRecovery =
              invoiceAmount *
              0.9;
  
            leaks.push({
              detectorId:
                "universal.failed-payment",
  
              leakType:
                "Failed Payment",
  
              title:
                "Failed payment revenue",
  
              description:
                `${customerName} has a failed or declined payment tied to $${invoiceAmount.toFixed(
                  2
                )} in invoice revenue.`,
  
              category:
                "Accounts Receivable",
  
              severity,
  
              confidence:
                "high",
  
              estimatedLoss:
                invoiceAmount,
  
              estimatedRecovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                paymentStatus,
  
                invoiceAmount,
  
                amountPaid,
  
                failed,
  
                dueDate:
                  cleanText(
                    row[
                      "Due Date"
                    ]
                  ),
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Contact the customer about the failed payment and request an updated payment method or retry the payment.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.failed-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };