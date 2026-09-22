import type {
    BusinessIntelligenceProfile,
  } from "../../types";
  
  import type {
    BusinessDataRow,
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
    DetectorResult,
  } from "../../detector-types";
  
  /* ================================== */
  /* HELPERS */
  /* ================================== */
  
  function getString(
    row: BusinessDataRow,
    field: string
  ): string | null {
    const value = row[field];
  
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }
  
    const result = String(value).trim();
  
    return result || null;
  }
  
  function getNumber(
    row: BusinessDataRow,
    field: string
  ): number | null {
    const value = row[field];
  
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }
  
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? value
        : null;
    }
  
    const cleaned = String(value)
      .replace(/[$,\s]/g, "")
      .trim();
  
    if (!cleaned) {
      return null;
    }
  
    const parsed = Number(cleaned);
  
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }
  
  function getDate(
    row: BusinessDataRow,
    field: string
  ): Date | null {
    const value = row[field];
  
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }
  
    const parsed = new Date(
      String(value)
    );
  
    if (
      Number.isNaN(parsed.getTime())
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function isPaidStatus(
    status: string | null
  ): boolean {
    if (!status) {
      return false;
    }
  
    const normalized =
      status.toLowerCase();
  
    return (
      normalized === "paid" ||
      normalized === "fully paid" ||
      normalized === "complete" ||
      normalized === "completed"
    );
  }
  
  /* ================================== */
  /* SUPPORT CHECK */
  /* ================================== */
  
  function supports(
    profile: BusinessIntelligenceProfile
  ): boolean {
    return (
      profile.capabilities.usesInvoices &&
      profile.capabilities.usesPayments
    );
  }
  
  /* ================================== */
  /* DETECTION */
  /* ================================== */
  
  function detect(
    context: DetectorContext
  ): DetectorResult {
    const leaks: DetectedBusinessLeak[] = [];
  
    const warnings: string[] = [];
  
    const {
      rows,
      now,
    } = context;
  
    rows.forEach(
      (row, index) => {
        const invoiceAmount =
          getNumber(
            row,
            "Invoice Amount"
          );
  
        if (
          invoiceAmount === null ||
          invoiceAmount <= 0
        ) {
          return;
        }
  
        const amountPaid =
          getNumber(
            row,
            "Amount Paid"
          ) ?? 0;
  
        const paymentStatus =
          getString(
            row,
            "Payment Status"
          );
  
        if (
          isPaidStatus(paymentStatus) &&
          amountPaid >= invoiceAmount
        ) {
          return;
        }
  
        const outstanding =
          Math.max(
            0,
            invoiceAmount -
              amountPaid
          );
  
        if (outstanding <= 0) {
          return;
        }
  
        const dueDate =
          getDate(
            row,
            "Due Date"
          );
  
        /*
          If a due date exists, only flag
          the invoice once it is overdue.
  
          If no due date exists, we can
          still flag an explicitly unpaid
          invoice, but with lower confidence.
        */
  
        const overdue =
          dueDate
            ? dueDate.getTime() <
              now.getTime()
            : false;
  
        const normalizedStatus =
          paymentStatus
            ?.toLowerCase()
            .trim() ?? "";
  
        const explicitlyUnpaid =
          [
            "unpaid",
            "overdue",
            "past due",
            "partially paid",
            "partial",
          ].includes(
            normalizedStatus
          );
  
        if (
          !overdue &&
          !explicitlyUnpaid
        ) {
          return;
        }
  
        const customerName =
          getString(
            row,
            "Customer Name"
          );
  
        const confidence =
          overdue &&
          explicitlyUnpaid
            ? "high"
            : dueDate ||
                explicitlyUnpaid
              ? "medium"
              : "low";
  
        const severity =
          outstanding >= 5000
            ? "critical"
            : outstanding >= 1000
              ? "high"
              : outstanding >= 250
                ? "medium"
                : "low";
  
        leaks.push({
          detectorId:
            "universal.unpaid-invoice",
  
          leakType:
            "Unpaid Invoice",
  
          title:
            "Outstanding invoice revenue",
  
          description:
            `${customerName ?? "A customer"} has $${outstanding.toFixed(
              2
            )} in unpaid invoice revenue.`,
  
          category:
            "Accounts Receivable",
  
          severity,
  
          confidence,
  
          estimatedLoss:
            outstanding,
  
          /*
            Because the money is already
            invoiced, the outstanding amount
            is treated as recoverable potential.
          */
  
          estimatedRecovery:
            outstanding,
  
          customerName,
  
          sourceRowIndex:
            index,
  
          evidence: {
            invoiceAmount,
            amountPaid,
            outstanding,
            paymentStatus,
            dueDate:
              dueDate
                ? dueDate.toISOString()
                : null,
            overdue,
          },
  
          recommendedAction:
            "Contact the customer about the outstanding balance and send a payment reminder.",
  
          metadata: {},
        });
      }
    );
  
    return {
      detectorId:
        "universal.unpaid-invoice",
  
      ran: true,
  
      leaks,
  
      warnings,
  
      errors: [],
    };
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unpaidInvoiceDetector:
    BusinessLeakDetector = {
    id:
      "universal.unpaid-invoice",
  
    name:
      "Unpaid Invoice Detector",
  
    description:
      "Detects overdue or explicitly unpaid invoice balances.",
  
    scope:
      "universal",
  
    industries: [],
  
    requirements: {
      requiredFields: [
        "Invoice Amount",
      ],
  
      optionalFields: [
        "Amount Paid",
        "Payment Status",
        "Due Date",
        "Customer Name",
      ],
  
      requiredCapabilities: [
        "usesInvoices",
        "usesPayments",
      ],
    },
  
    supports,
  
    detect,
  };