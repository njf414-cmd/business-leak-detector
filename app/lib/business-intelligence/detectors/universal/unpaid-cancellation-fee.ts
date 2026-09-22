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
  /* FEE TYPES */
  /* ================================== */
  
  /*
    We only want fees tied to cancellation,
    no-show, or missed-appointment events.
  
    A generic fee should NOT automatically
    become a cancellation-fee leak.
  */
  
  const CANCELLATION_FEE_TYPES = [
    "cancellation",
    "cancellation fee",
    "cancel fee",
    "late cancellation",
    "late cancellation fee",
    "late cancel",
    "late cancel fee",
    "no show",
    "no show fee",
    "no-show",
    "no-show fee",
    "missed appointment",
    "missed appointment fee",
  ];
  
  /* ================================== */
  /* UNPAID FEE STATUSES */
  /* ================================== */
  
  const UNPAID_FEE_STATUSES = [
    "unpaid",
    "not paid",
    "outstanding",
    "past due",
    "overdue",
    "due",
    "payment due",
    "pending collection",
    "uncollected",
    "not collected",
    "collection pending",
    "failed",
    "payment failed",
    "declined",
  ];
  
  /* ================================== */
  /* PAID / CLOSED STATUSES */
  /* ================================== */
  
  const PAID_FEE_STATUSES = [
    "paid",
    "collected",
    "received",
    "complete",
    "completed",
    "settled",
    "waived",
    "forgiven",
    "void",
    "voided",
    "refunded",
  ];
  
  /* ================================== */
  /* CANCELLATION EVENT STATUSES */
  /* ================================== */
  
  const CANCELLATION_EVENT_STATUSES = [
    "cancelled",
    "canceled",
    "late cancelled",
    "late canceled",
    "late cancellation",
    "no show",
    "no-show",
    "missed appointment",
  ];
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unpaidCancellationFeeDetector:
    BusinessLeakDetector = {
      id:
        "universal.unpaid-cancellation-fee",
  
      name:
        "Unpaid Cancellation Fee",
  
      description:
        "Detects explicitly assessed cancellation, no-show, late-cancellation, or missed-appointment fees that remain unpaid or uncollected.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Fee Amount",
          "Fee Status",
          "Fee Type",
          "Appointment Status",
          "Job Status",
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
  
            const feeAmount =
              parseMoney(
                row["Fee Amount"]
              );
  
            /*
              STRICT AMOUNT OWNERSHIP
  
              We must have an explicit positive
              Fee Amount.
  
              Never substitute:
              - Invoice Amount
              - Job Amount
              - Quote Amount
              - Deposit Amount
              - Recurring Amount
              - Renewal Amount
              - Amount Paid
            */
  
            if (
              feeAmount === null ||
              feeAmount <= 0
            ) {
              return;
            }
  
            const feeStatus =
              row["Fee Status"];
  
            const feeType =
              row["Fee Type"];
  
            const appointmentStatus =
              row["Appointment Status"];
  
            const jobStatus =
              row["Job Status"];
  
            const paymentStatus =
              row["Payment Status"];
  
            const generalStatus =
              row["Status"];
  
            /* ================================== */
            /* PAID / WAIVED / CLOSED */
            /* ================================== */
  
            if (
              matchesStatus(
                feeStatus,
                PAID_FEE_STATUSES
              )
            ) {
              return;
            }
  
            /*
              If the fee-specific status is
              missing, an explicitly paid
              payment status is also enough
              to back off.
            */
  
            if (
              !hasValue(feeStatus) &&
              matchesStatus(
                paymentStatus,
                [
                  "paid",
                  "collected",
                  "settled",
                  "completed",
                  "complete",
                ]
              )
            ) {
              return;
            }
  
            /* ================================== */
            /* VERIFY FEE TYPE */
            /* ================================== */
  
            const explicitCancellationFee =
              matchesStatus(
                feeType,
                CANCELLATION_FEE_TYPES
              );
  
            /*
              Some systems may not provide
              Fee Type.
  
              In that case we can still use an
              explicit cancellation/no-show
              event, but ONLY when Fee Status
              explicitly says the assessed fee
              remains unpaid.
            */
  
            const cancellationEvent =
              matchesStatus(
                appointmentStatus,
                CANCELLATION_EVENT_STATUSES
              ) ||
              matchesStatus(
                jobStatus,
                CANCELLATION_EVENT_STATUSES
              ) ||
              matchesStatus(
                generalStatus,
                CANCELLATION_EVENT_STATUSES
              );
  
            const explicitlyUnpaid =
              matchesStatus(
                feeStatus,
                UNPAID_FEE_STATUSES
              );
  
            /*
              CONFIRMED PATH A
  
              Explicit cancellation-type fee
              + explicit unpaid fee status.
            */
  
            const explicitFeePath =
              explicitCancellationFee &&
              explicitlyUnpaid;
  
            /*
              CONFIRMED PATH B
  
              Explicit cancellation/no-show
              event + explicit unpaid fee status.
  
              This allows systems without a
              dedicated Fee Type field while
              still requiring strong evidence.
            */
  
            const eventPath =
              cancellationEvent &&
              explicitlyUnpaid;
  
            if (
              !explicitFeePath &&
              !eventPath
            ) {
              return;
            }
  
            /* ================================== */
            /* CREATE FINDING */
            /* ================================== */
  
            leaks.push({
              detectorId:
                "universal.unpaid-cancellation-fee",
  
              leakType:
                "Unpaid Cancellation Fee",
  
              title:
                "Cancellation fee remains uncollected",
  
              description:
                `${customerName} has a $${feeAmount.toFixed(
                  2
                )} cancellation or no-show fee that appears to remain unpaid.`,
  
              category:
                "Accounts Receivable",
  
              severity:
                feeAmount >= 1000
                  ? "high"
                  : feeAmount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                explicitFeePath
                  ? "high"
                  : "medium",
  
              estimatedLoss:
                feeAmount,
  
              estimatedRecovery:
                feeAmount,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                feeAmount,
  
                feeStatus:
                  cleanText(
                    feeStatus
                  ),
  
                feeType:
                  cleanText(
                    feeType
                  ),
  
                appointmentStatus:
                  cleanText(
                    appointmentStatus
                  ),
  
                jobStatus:
                  cleanText(
                    jobStatus
                  ),
  
                paymentStatus:
                  cleanText(
                    paymentStatus
                  ),
  
                status:
                  cleanText(
                    generalStatus
                  ),
  
                explicitCancellationFee,
  
                cancellationEvent,
  
                explicitlyUnpaid,
  
                detectionPath:
                  explicitFeePath
                    ? "explicit_fee_type_and_unpaid_status"
                    : "cancellation_event_and_unpaid_fee_status",
              },
  
              recommendedAction:
                "Verify the cancellation or no-show fee is valid under the business policy, confirm it has not already been waived or collected, then contact the customer and collect the outstanding fee.",
  
              metadata: {
                revenueType:
                  "fee",
  
                amountSource:
                  "Fee Amount",
  
                feeCategory:
                  "cancellation",
  
                detectionReason:
                  explicitFeePath
                    ? "explicit_unpaid_cancellation_fee"
                    : "unpaid_fee_with_cancellation_event",
              },
            });
          }
        );
  
        return {
          detectorId:
            "universal.unpaid-cancellation-fee",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };