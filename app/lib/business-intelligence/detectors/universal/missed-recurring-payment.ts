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
  
  function parseDate(
    value: unknown
  ): Date | null {
    if (!hasValue(value)) {
      return null;
    }
  
    const parsed = new Date(
      cleanText(value)
    );
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed;
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
  /* RECURRING STATUS RULES */
  /* ================================== */
  
  /*
    These explicitly indicate that a
    recurring payment was not collected.
  */
  
  const MISSED_STATUSES = [
    "missed",
    "missed payment",
    "payment missed",
    "past due",
    "overdue",
    "unpaid",
    "payment failed",
    "failed payment",
    "failed",
    "declined",
    "charge failed",
    "billing failed",
    "collection failed",
  ];
  
  /*
    These mean the recurring agreement
    should no longer be treated as an
    active collectible payment.
  */
  
  const INACTIVE_STATUSES = [
    "cancelled",
    "canceled",
    "inactive",
    "terminated",
    "expired",
    "ended",
    "closed",
    "paused",
    "suspended",
  ];
  
  /*
    These explicitly indicate that the
    recurring payment is healthy.
  */
  
  const HEALTHY_STATUSES = [
    "paid",
    "current",
    "active paid",
    "payment complete",
    "payment completed",
    "charge successful",
    "payment successful",
    "collected",
  ];
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const missedRecurringPaymentDetector:
    BusinessLeakDetector = {
      id:
        "universal.missed-recurring-payment",
  
      name:
        "Missed Recurring Payment",
  
      description:
        "Detects explicitly missed recurring, subscription, membership, or automatic payments that should already have been collected.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Recurring Amount",
          "Recurring Status",
          "Next Payment Date",
          "Payment Status",
          "Status",
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
  
            const recurringAmount =
              parseMoney(
                row["Recurring Amount"]
              );
  
            /*
              We require an explicit recurring
              monetary amount.
  
              The detector must never substitute
              Invoice Amount, Job Amount, or
              Amount Paid.
            */
  
            if (
              recurringAmount === null ||
              recurringAmount <= 0
            ) {
              return;
            }
  
            const recurringStatus =
              row["Recurring Status"];
  
            const paymentStatus =
              row["Payment Status"];
  
            const generalStatus =
              row["Status"];
  
            /* ================================== */
            /* INACTIVE / CANCELLED */
            /* ================================== */
  
            const recurringIsInactive =
              matchesStatus(
                recurringStatus,
                INACTIVE_STATUSES
              );
  
            if (recurringIsInactive) {
              return;
            }
  
            /* ================================== */
            /* ALREADY PAID */
            /* ================================== */
  
            const paymentIsHealthy =
              matchesStatus(
                paymentStatus,
                HEALTHY_STATUSES
              );
  
            if (paymentIsHealthy) {
              return;
            }
  
            /* ================================== */
            /* EXPLICIT MISSED SIGNAL */
            /* ================================== */
  
            const explicitMissedSignal =
              matchesStatus(
                recurringStatus,
                MISSED_STATUSES
              ) ||
              matchesStatus(
                paymentStatus,
                MISSED_STATUSES
              );
  
            /* ================================== */
            /* PAYMENT DATE */
            /* ================================== */
  
            const nextPaymentDate =
              parseDate(
                row["Next Payment Date"]
              );
  
            let paymentDateHasPassed =
              false;
  
            if (nextPaymentDate) {
              paymentDateHasPassed =
                nextPaymentDate.getTime() <
                context.now.getTime();
            }
  
            /*
              Safety rule:
  
              We only report a confirmed leak if:
  
              1. The data explicitly says the
                 recurring payment was missed,
                 failed, declined, unpaid, etc.
  
              OR
  
              2. There is an explicit recurring
                 payment date in the past AND the
                 recurring record is still active.
  
              We do not treat future payment dates
              as leaks.
            */
  
            const recurringIsActive =
              matchesStatus(
                recurringStatus,
                [
                  "active",
                  "current",
                  "enabled",
                  "recurring",
                  "subscription active",
                  "membership active",
                  "autopay active",
                  "auto pay active",
                ]
              );
  
            const missedByPastDate =
              recurringIsActive &&
              paymentDateHasPassed;
  
            if (
              !explicitMissedSignal &&
              !missedByPastDate
            ) {
              return;
            }
  
            /* ================================== */
            /* CREATE FINDING */
            /* ================================== */
  
            leaks.push({
              detectorId:
                "universal.missed-recurring-payment",
  
              leakType:
                "Missed Recurring Payment",
  
              title:
                "Recurring payment was not collected",
  
              description:
                `${customerName} has a recurring payment of $${recurringAmount.toFixed(
                  2
                )} that appears to have been missed or not collected.`,
  
              category:
                "Accounts Receivable",
  
              severity:
                recurringAmount >= 1000
                  ? "high"
                  : recurringAmount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                explicitMissedSignal
                  ? "high"
                  : "medium",
  
              estimatedLoss:
                recurringAmount,
  
              estimatedRecovery:
                recurringAmount,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                recurringAmount,
  
                recurringStatus:
                  cleanText(
                    recurringStatus
                  ),
  
                paymentStatus:
                  cleanText(
                    paymentStatus
                  ),
  
                status:
                  cleanText(
                    generalStatus
                  ),
  
                nextPaymentDate:
                  cleanText(
                    row[
                      "Next Payment Date"
                    ]
                  ),
  
                paymentDateHasPassed,
  
                explicitMissedSignal,
  
                missedByPastDate,
              },
  
              recommendedAction:
                "Verify the recurring account is still active, retry or collect the missed payment, contact the customer if necessary, and update the recurring billing record.",
  
              metadata: {
                revenueType:
                  "recurring",
  
                amountSource:
                  "Recurring Amount",
  
                detectionReason:
                  explicitMissedSignal
                    ? "explicit_missed_payment_status"
                    : "active_recurring_payment_past_due",
              },
            });
          }
        );
  
        return {
          detectorId:
            "universal.missed-recurring-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };