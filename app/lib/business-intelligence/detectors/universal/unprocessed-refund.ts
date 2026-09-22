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
    return (
      value !== null &&
      value !== undefined &&
      cleanText(value) !== ""
    );
  }
  
  function parseMoney(
    value: unknown
  ): number | null {
    if (!hasValue(value)) {
      return null;
    }
  
    const cleaned = cleanText(value)
      .replace(/[$,]/g, "")
      .replace(/[^\d.-]/g, "");
  
    if (!cleaned) {
      return null;
    }
  
    const parsed = Number(cleaned);
  
    if (!Number.isFinite(parsed)) {
      return null;
    }
  
    return Math.max(0, parsed);
  }
  
  function matchesStatus(
    value: unknown,
    statuses: string[]
  ): boolean {
    return statuses.includes(
      normalizeText(value)
    );
  }
  
  /* ================================== */
  /* REFUND STATUS RULES */
  /* ================================== */
  
  const REFUND_OWED_STATUSES = [
    "refund due",
    "refund owed",
    "refund pending",
    "pending refund",
    "refund approved",
    "approved refund",
    "refund requested",
    "refund required",
    "needs refund",
    "needs refunded",
    "awaiting refund",
    "refund not issued",
    "refund not processed",
    "unprocessed refund",
  ];
  
  const REFUND_COMPLETE_STATUSES = [
    "refunded",
    "refund complete",
    "refund completed",
    "refund issued",
    "refund processed",
    "fully refunded",
  ];
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unprocessedRefundDetector:
    BusinessLeakDetector = {
      id:
        "universal.unprocessed-refund",
  
      name:
        "Unprocessed Refund",
  
      description:
        "Detects explicit customer refunds that are due, approved, requested, or pending but have not yet been processed.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Payment Status",
          "Billing Status",
          "Refund Amount",
          "Amount Paid",
          "Invoice Amount",
          "Job Amount",
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
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const status =
              row["Status"];
  
            const paymentStatus =
              row["Payment Status"];
  
            const billingStatus =
              row["Billing Status"];
  
            /* ================================== */
            /* ALREADY REFUNDED */
            /* ================================== */
  
            const refundAlreadyCompleted =
              matchesStatus(
                status,
                REFUND_COMPLETE_STATUSES
              ) ||
              matchesStatus(
                paymentStatus,
                REFUND_COMPLETE_STATUSES
              ) ||
              matchesStatus(
                billingStatus,
                REFUND_COMPLETE_STATUSES
              );
  
            if (refundAlreadyCompleted) {
              return;
            }
  
            /* ================================== */
            /* EXPLICIT REFUND SIGNAL */
            /* ================================== */
  
            const refundIsOwed =
              matchesStatus(
                status,
                REFUND_OWED_STATUSES
              ) ||
              matchesStatus(
                paymentStatus,
                REFUND_OWED_STATUSES
              ) ||
              matchesStatus(
                billingStatus,
                REFUND_OWED_STATUSES
              );
  
            if (!refundIsOwed) {
              return;
            }
  
            /* ================================== */
            /* EXPLICIT REFUND AMOUNT */
            /* ================================== */
  
            /*
              Critical safety rule:
  
              We NEVER use Amount Paid,
              Invoice Amount, or Job Amount
              to guess the refund.
  
              The dataset must explicitly
              provide Refund Amount.
            */
  
            const refundAmount =
              parseMoney(
                row["Refund Amount"]
              );
  
            if (
              refundAmount === null ||
              refundAmount <= 0
            ) {
              return;
            }
  
            /* ================================== */
            /* CREATE FINDING */
            /* ================================== */
  
            leaks.push({
              detectorId:
                "universal.unprocessed-refund",
  
              leakType:
                "Unprocessed Refund",
  
              title:
                "Customer refund still pending",
  
              description:
                `${customerName} has an explicit refund of $${refundAmount.toFixed(
                  2
                )} that is still due or awaiting processing.`,
  
              category:
                "Billing",
  
              severity:
                refundAmount >= 1000
                  ? "high"
                  : refundAmount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              /*
                This is money owed back to
                the customer.
  
                It is financial exposure,
                not recoverable revenue.
              */
  
              estimatedLoss:
                refundAmount,
  
              estimatedRecovery:
                0,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                refundAmount,
  
                status:
                  cleanText(status),
  
                paymentStatus:
                  cleanText(
                    paymentStatus
                  ),
  
                billingStatus:
                  cleanText(
                    billingStatus
                  ),
  
                amountPaid:
                  parseMoney(
                    row["Amount Paid"]
                  ),
  
                invoiceAmount:
                  parseMoney(
                    row["Invoice Amount"]
                  ),
  
                jobAmount:
                  parseMoney(
                    row["Job Amount"]
                  ),
  
                date:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Verify the approved refund, process the outstanding refund or customer credit, and update the payment record so the refund is marked as completed.",
  
              metadata: {
                liabilityType:
                  "customer_refund",
  
                amountSource:
                  "Refund Amount",
              },
            });
          }
        );
  
        return {
          detectorId:
            "universal.unprocessed-refund",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };