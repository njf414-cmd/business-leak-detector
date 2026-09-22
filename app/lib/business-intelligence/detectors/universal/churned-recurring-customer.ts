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
  
    const cleaned =
      cleanText(value)
        .replace(/[$,]/g, "")
        .replace(/[^\d.-]/g, "");
  
    if (!cleaned) {
      return null;
    }
  
    const parsed =
      Number(cleaned);
  
    if (!Number.isFinite(parsed)) {
      return null;
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
    return statuses.includes(
      normalizeText(value)
    );
  }
  
  /* ================================== */
  /* STATUS RULES */
  /* ================================== */
  
  /*
    These statuses indicate that an
    established recurring relationship
    is no longer active.
  
    IMPORTANT:
  
    This detector does NOT treat these
    statuses as automatically recoverable.
  
    It identifies recurring revenue that
    appears to have churned.
  */
  
  const CHURNED_STATUSES = [
    "churned",
    "customer churned",
    "membership cancelled",
    "membership canceled",
    "subscription cancelled",
    "subscription canceled",
    "plan cancelled",
    "plan canceled",
    "service cancelled",
    "service canceled",
    "contract cancelled",
    "contract canceled",
    "inactive",
    "terminated",
    "expired",
    "ended",
  ];
  
  /*
    These indicate the recurring
    relationship is still active.
  */
  
  const ACTIVE_STATUSES = [
    "active",
    "current",
    "enabled",
    "recurring",
    "subscription active",
    "membership active",
    "plan active",
    "contract active",
    "agreement active",
    "service active",
  ];
  
  /*
    These indicate a temporary billing
    problem rather than actual churn.
  
    Detector #21 owns these situations.
  */
  
  const PAYMENT_PROBLEM_STATUSES = [
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
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const churnedRecurringCustomerDetector:
    BusinessLeakDetector = {
      id:
        "universal.churned-recurring-customer",
  
      name:
        "Churned Recurring Customer",
  
      description:
        "Detects established recurring customers whose membership, subscription, contract, or recurring service has become inactive or cancelled.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Recurring Amount",
          "Recurring Status",
          "Next Payment Date",
          "Renewal Amount",
          "Renewal Date",
          "Renewal Status",
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
              STRICT AMOUNT OWNERSHIP
  
              Churn must have an explicit
              recurring revenue amount.
  
              Never substitute:
              - Renewal Amount
              - Invoice Amount
              - Job Amount
              - Quote Amount
              - Amount Paid
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
  
            const renewalStatus =
              row["Renewal Status"];
  
            const generalStatus =
              row["Status"];
  
            /* ================================== */
            /* STILL ACTIVE */
            /* ================================== */
  
            if (
              matchesStatus(
                recurringStatus,
                ACTIVE_STATUSES
              )
            ) {
              return;
            }
  
            /* ================================== */
            /* PAYMENT PROBLEM — #21 OWNS IT */
            /* ================================== */
  
            if (
              matchesStatus(
                recurringStatus,
                PAYMENT_PROBLEM_STATUSES
              ) ||
              matchesStatus(
                paymentStatus,
                PAYMENT_PROBLEM_STATUSES
              )
            ) {
              return;
            }
  
            /* ================================== */
            /* RENEWAL PROBLEM — #22 OWNS IT */
            /* ================================== */
  
            const renewalProblem =
              matchesStatus(
                renewalStatus,
                [
                  "not renewed",
                  "unrenewed",
                  "renewal missed",
                  "missed renewal",
                  "renewal overdue",
                  "overdue renewal",
                  "renewal past due",
                  "renewal due",
                  "pending renewal",
                  "renewal pending",
                  "awaiting renewal",
                  "needs renewal",
                  "renewal required",
                ]
              );
  
            if (renewalProblem) {
              return;
            }
  
            /* ================================== */
            /* EXPLICIT CHURN */
            /* ================================== */
  
            const explicitRecurringChurn =
              matchesStatus(
                recurringStatus,
                CHURNED_STATUSES
              );
  
            /*
              Generic Status may provide a
              strong churn signal, but only
              when recurring data exists.
  
              The explicit Recurring Amount
              requirement above prevents a
              random cancelled one-time job
              from becoming recurring churn.
            */
  
            const explicitGeneralChurn =
              matchesStatus(
                generalStatus,
                [
                  "churned",
                  "customer churned",
                  "membership cancelled",
                  "membership canceled",
                  "subscription cancelled",
                  "subscription canceled",
                ]
              );
  
            const confirmedChurn =
              explicitRecurringChurn ||
              explicitGeneralChurn;
  
            if (!confirmedChurn) {
              return;
            }
  
            /* ================================== */
            /* CREATE FINDING */
            /* ================================== */
  
            leaks.push({
              detectorId:
                "universal.churned-recurring-customer",
  
              leakType:
                "Churned Recurring Customer",
  
              title:
                "Recurring customer churn detected",
  
              description:
                `${customerName} appears to have ended a recurring relationship worth $${recurringAmount.toFixed(
                  2
                )} per billing cycle.`,
  
              category:
                "Recurring Revenue",
  
              severity:
                recurringAmount >= 1500
                  ? "high"
                  : recurringAmount >= 750
                    ? "medium"
                    : "low",
  
              /*
                Churn is explicit, but recovery
                is not guaranteed.
              */
  
              confidence:
                "high",
  
              estimatedLoss:
                recurringAmount,
  
              /*
                Unlike an unpaid invoice,
                churned recurring revenue is
                not money legally owed.
  
                Use a conservative recovery
                estimate rather than assuming
                100% can be recovered.
              */
  
              estimatedRecovery:
                Math.round(
                  recurringAmount *
                    0.35 *
                    100
                ) / 100,
  
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
  
                renewalStatus:
                  cleanText(
                    renewalStatus
                  ),
  
                status:
                  cleanText(
                    generalStatus
                  ),
  
                explicitRecurringChurn,
  
                explicitGeneralChurn,
              },
  
              recommendedAction:
                "Review why the recurring customer became inactive, contact them with a win-back offer, resolve any service or billing issue, and attempt to reactivate the membership, subscription, contract, or recurring service.",
  
              metadata: {
                revenueType:
                  "recurring",
  
                amountSource:
                  "Recurring Amount",
  
                recoveryRate:
                  0.35,
  
                detectionReason:
                  explicitRecurringChurn
                    ? "explicit_recurring_churn_status"
                    : "explicit_general_churn_status_with_recurring_revenue",
              },
            });
          }
        );
  
        return {
          detectorId:
            "universal.churned-recurring-customer",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };