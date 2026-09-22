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
  
    return Math.max(0, parsed);
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
  
  function isDepositPaid(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "paid",
        "deposit paid",
        "paid in full",
        "received",
        "collected",
        "complete",
        "completed",
        "yes",
        "true",
        "1",
      ]
    );
  }
  
  function isDepositUnpaid(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "unpaid",
        "deposit unpaid",
        "not paid",
        "not collected",
        "due",
        "payment due",
        "pending",
        "awaiting payment",
        "outstanding",
        "no",
        "false",
        "0",
      ]
    );
  }
  
  function isActiveJobStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "accepted",
        "approved",
        "booked",
        "scheduled",
        "won",
        "closed won",
        "sold",
        "customer",
        "job scheduled",
        "work scheduled",
        "contract signed",
      ]
    );
  }
  
  function isDeadStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "cancelled",
        "canceled",
        "closed lost",
        "lost",
        "void",
        "voided",
        "refunded",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const uncollectedDepositDetector:
    BusinessLeakDetector = {
      id:
        "universal.uncollected-deposit",
  
      name:
        "Uncollected Deposit",
  
      description:
        "Detects accepted, booked, or scheduled work where a required customer deposit has not been fully collected.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Job Status",
          "Job Amount",
          "Quote Amount",
          "Deposit Amount",
          "Deposit Paid",
          "Deposit Status",
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
              Cancelled/lost work should not
              produce a collectible deposit.
            */
  
            if (
              isDeadStatus(status) ||
              isDeadStatus(jobStatus)
            ) {
              return;
            }
  
            /*
              Require evidence that the work
              has actually been accepted,
              booked, or scheduled.
  
              This prevents ordinary open
              estimates from being treated as
              missing deposits.
            */
  
            const activeJob =
              isActiveJobStatus(status) ||
              isActiveJobStatus(jobStatus);
  
            if (!activeJob) {
              return;
            }
  
            const depositAmount =
              parseMoney(
                row["Deposit Amount"]
              );
  
            /*
              A confirmed required deposit
              amount must exist.
  
              We do NOT invent a deposit from
              the job value.
            */
  
            if (
              depositAmount <= 0
            ) {
              return;
            }
  
            const depositPaid =
              parseMoney(
                row["Deposit Paid"]
              );
  
            const depositStatus =
              cleanText(
                row["Deposit Status"]
              );
  
            /*
              Explicitly completed deposits
              are not leaks.
            */
  
            if (
              isDepositPaid(
                depositStatus
              ) &&
              depositPaid >=
                depositAmount
            ) {
              return;
            }
  
            /*
              If the numeric amount proves
              the full deposit was collected,
              trust the numeric evidence even
              if the status is stale.
            */
  
            if (
              depositPaid >=
              depositAmount
            ) {
              return;
            }
  
            const remainingDeposit =
              Math.max(
                0,
                depositAmount -
                  depositPaid
              );
  
            if (
              remainingDeposit <= 0
            ) {
              return;
            }
  
            /*
              Require either:
  
              1. explicit unpaid/pending status
              OR
              2. numeric proof that some/all of
                 the required deposit remains.
  
              Since a positive required deposit
              and a smaller paid amount provide
              numeric evidence, the detector can
              still operate when status is blank.
            */
  
            const explicitlyUnpaid =
              isDepositUnpaid(
                depositStatus
              );
  
            const numericShortfall =
              depositPaid <
              depositAmount;
  
            if (
              !explicitlyUnpaid &&
              !numericShortfall
            ) {
              return;
            }
  
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const jobAmount =
              parseMoney(
                row["Job Amount"]
              );
  
            const quoteAmount =
              parseMoney(
                row["Quote Amount"]
              );
  
            const relatedJobValue =
              jobAmount > 0
                ? jobAmount
                : quoteAmount;
  
            leaks.push({
              detectorId:
                "universal.uncollected-deposit",
  
              leakType:
                "Uncollected Deposit",
  
              title:
                "Required deposit not fully collected",
  
              description:
                `${customerName} has $${remainingDeposit.toFixed(
                  2
                )} of a required $${depositAmount.toFixed(
                  2
                )} deposit still uncollected.`,
  
              category:
                "Accounts Receivable",
  
              severity:
                remainingDeposit >= 1000
                  ? "high"
                  : remainingDeposit >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                explicitlyUnpaid
                  ? "high"
                  : "medium",
  
              estimatedLoss:
                remainingDeposit,
  
              /*
                Unlike lost revenue, an unpaid
                deposit is still fully
                collectible in principle.
              */
  
              estimatedRecovery:
                remainingDeposit,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                jobStatus,
  
                depositStatus,
  
                depositRequired:
                  depositAmount,
  
                depositCollected:
                  depositPaid,
  
                depositRemaining:
                  remainingDeposit,
  
                relatedJobValue,
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Contact the customer and collect the remaining required deposit before beginning or continuing the work.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.uncollected-deposit",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };