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
  
  export const partialPaymentDetector:
    BusinessLeakDetector = {
      id:
        "universal.partial-payment",
  
      name:
        "Partial Payment",
  
      description:
        "Detects invoices where only part of the balance has been collected and money is still outstanding.",
  
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
              Match legacy behavior:
  
              Fully paid records are never
              partial-payment leaks.
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
              A partial payment can be proven
              in two ways:
  
              1. Status explicitly says partial
              2. Amount Paid is greater than 0
                 but less than Invoice Amount
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
              !statusPartial &&
              !amountPartial
            ) {
              return;
            }
  
            /*
              Legacy behavior:
  
              If actual payment data proves
              how much remains, calculate the
              remaining balance.
  
              Otherwise, if we only know the
              status is partial, treat the
              invoice amount as the amount
              currently at risk.
            */
  
            const remainingBalance =
              amountPartial
                ? Math.max(
                    0,
                    invoiceAmount -
                      amountPaid
                  )
                : invoiceAmount;
  
            if (
              remainingBalance <= 0
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
  
            /*
              Payment leaks use the legacy
              payment severity thresholds:
  
              High   >= $1,000
              Medium >= $500
              Low    <  $500
            */
  
            const severity =
              remainingBalance >=
              1000
                ? "high"
                : remainingBalance >=
                    500
                  ? "medium"
                  : "low";
  
            leaks.push({
              detectorId:
                "universal.partial-payment",
  
              leakType:
                "Partial Payment",
  
              title:
                "Outstanding partial payment",
  
              description:
                `${customerName} has an invoice of $${invoiceAmount.toFixed(
                  2
                )} with $${remainingBalance.toFixed(
                  2
                )} still outstanding.`,
  
              category:
                "Accounts Receivable",
  
              severity,
  
              confidence:
                amountPartial
                  ? "high"
                  : "medium",
  
              estimatedLoss:
                remainingBalance,
  
              /*
                Legacy recovery rate for
                Partial Payment is 100%.
              */
  
              estimatedRecovery:
                remainingBalance,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                paymentStatus,
  
                invoiceAmount,
  
                amountPaid,
  
                remainingBalance,
  
                statusPartial,
  
                amountPartial,
  
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
                "Contact the customer about the remaining balance and send a payment reminder or updated invoice.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.partial-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };