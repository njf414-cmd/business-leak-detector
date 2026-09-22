import type {
    BusinessLeakDetector,
    DetectorContext,
    DetectorResult,
    DetectedBusinessLeak,
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
  ): number | null {
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }
  
    const cleaned =
      String(value)
        .replace(/[$,%\s,]/g, "")
        .trim();
  
    if (!cleaned) {
      return null;
    }
  
    const parsed =
      Number(cleaned);
  
    if (
      !Number.isFinite(parsed)
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function matchesStatus(
    value: unknown,
    statuses: string[]
  ): boolean {
    const normalized =
      normalizeText(value);
  
    return statuses.includes(
      normalized
    );
  }
  
  /* ================================== */
  /* STATUS RULES */
  /* ================================== */
  
  const UNPAID_STATUSES = [
    "unpaid",
    "outstanding",
    "past due",
    "overdue",
    "uncollected",
    "not paid",
    "payment due",
    "due",
    "pending collection",
    "collection pending",
  ];
  
  const PAID_STATUSES = [
    "paid",
    "collected",
    "settled",
    "complete",
    "completed",
    "payment complete",
    "payment completed",
  ];
  
  const INVALID_STATUSES = [
    "waived",
    "void",
    "voided",
    "cancelled",
    "canceled",
    "forgiven",
    "removed",
    "reversed",
  ];
  
  const LATE_FEE_TYPES = [
    "late fee",
    "late payment fee",
    "overdue fee",
    "past due fee",
    "delinquency fee",
    "late charge",
    "late payment charge",
    "overdue charge",
    "penalty fee",
    "payment penalty",
  ];
  
  /* ================================== */
  /* DETECTION */
  /* ================================== */
  
  function detect(
    context: DetectorContext
  ): DetectorResult {
    const leaks:
      DetectedBusinessLeak[] = [];
  
    const warnings: string[] = [];
    const errors: string[] = [];
  
    context.rows.forEach(
      (row, index) => {
        const customerName =
          cleanText(
            row["Customer Name"]
          ) || null;
  
        const feeAmount =
          parseMoney(
            row["Fee Amount"]
          );
  
        const feeType =
          normalizeText(
            row["Fee Type"]
          );
  
        const feeStatus =
          normalizeText(
            row["Fee Status"]
          );
  
        /*
          SAFETY RULE #1
  
          Never infer a fee amount from
          Invoice Amount, Job Amount,
          Renewal Amount, Recurring Amount,
          Deposit Amount, Quote Amount,
          or any other money field.
        */
  
        if (
          feeAmount === null ||
          feeAmount <= 0
        ) {
          return;
        }
  
        /*
          SAFETY RULE #2
  
          This detector owns LATE FEES only.
  
          Cancellation/no-show fees belong
          to Detector #24.
        */
  
        if (
          !LATE_FEE_TYPES.includes(
            feeType
          )
        ) {
          return;
        }
  
        /*
          SAFETY RULE #3
  
          Explicit paid/waived/voided/etc.
          always wins.
        */
  
        if (
          matchesStatus(
            feeStatus,
            PAID_STATUSES
          ) ||
          matchesStatus(
            feeStatus,
            INVALID_STATUSES
          )
        ) {
          return;
        }
  
        /*
          SAFETY RULE #4
  
          We require explicit evidence that
          the late fee is still unpaid.
        */
  
        if (
          !matchesStatus(
            feeStatus,
            UNPAID_STATUSES
          )
        ) {
          return;
        }
  
        const severity =
          feeAmount >= 1000
            ? "high"
            : feeAmount >= 500
              ? "medium"
              : "low";
  
        leaks.push({
          detectorId:
            "universal.uncollected-late-fee",
  
          leakType:
            "Uncollected Late Fee",
  
          title:
            "Uncollected Late Fee",
  
          description:
            `${customerName ?? "Customer"} has an explicitly recorded late fee of $${feeAmount.toFixed(
              2
            )} that is still marked as ${cleanText(
              row["Fee Status"]
            )}.`,
  
          category:
            "Accounts Receivable",
  
          severity,
  
          confidence:
            "high",
  
          estimatedLoss:
            feeAmount,
  
          estimatedRecovery:
            feeAmount,
  
          customerName,
  
          sourceRowIndex:
            index,
  
          evidence: {
            feeAmount,
            feeType:
              cleanText(
                row["Fee Type"]
              ),
            feeStatus:
              cleanText(
                row["Fee Status"]
              ),
          },
  
          recommendedAction:
            "Verify the late fee is still valid, contact the customer, and collect the outstanding fee.",
  
          metadata: {
            revenueType:
              "late_fee",
  
            amountSource:
              "Fee Amount",
  
            detectionReason:
              "explicit_uncollected_late_fee",
          },
        });
      }
    );
  
    return {
      detectorId:
        "universal.uncollected-late-fee",
  
      ran: true,
  
      leaks,
  
      warnings,
  
      errors,
    };
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const uncollectedLateFeeDetector:
    BusinessLeakDetector = {
      id:
        "universal.uncollected-late-fee",
  
      name:
        "Uncollected Late Fee",
  
      description:
        "Detects explicit late-payment fees that are valid and remain unpaid or uncollected.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        requiredFields: [],
  
        optionalFields: [
          "Customer Name",
          "Fee Amount",
          "Fee Type",
          "Fee Status",
          "Payment Status",
          "Invoice Amount",
          "Due Date",
          "Status",
          "Date",
        ],
      },
  
      supports() {
        return true;
      },
  
      detect,
    };