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
    const normalized =
      normalizeText(value);
  
    return statuses.includes(
      normalized
    );
  }
  
  /* ================================== */
  /* STATUS RULES */
  /* ================================== */
  
  const DEAD_STATUSES = [
    "cancelled",
    "canceled",
    "void",
    "voided",
    "refunded",
    "lost",
    "closed lost",
    "no show",
    "no-show",
  ];
  
  function isDeadRecord(
    status: unknown,
    jobStatus: unknown
  ): boolean {
    return (
      matchesStatus(
        status,
        DEAD_STATUSES
      ) ||
      matchesStatus(
        jobStatus,
        DEAD_STATUSES
      )
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const overpaymentDetector:
    BusinessLeakDetector = {
      id:
        "universal.overpayment",
  
      name:
        "Overpayment",
  
      description:
        "Detects cases where a customer has paid more than the explicit amount they owed.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Job Status",
          "Invoice Amount",
          "Job Amount",
          "Amount Paid",
          "Payment Status",
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
  
            const jobStatus =
              row["Job Status"];
  
            /*
              Cancelled, voided, refunded,
              lost, and no-show records should
              not create an overpayment finding.
            */
  
            if (
              isDeadRecord(
                status,
                jobStatus
              )
            ) {
              return;
            }
  
            /*
              Amount Paid MUST explicitly exist.
  
              Missing payment data must never
              be interpreted as zero or as an
              overpayment.
            */
  
            const amountPaid =
              parseMoney(
                row["Amount Paid"]
              );
  
            if (
              amountPaid === null ||
              amountPaid <= 0
            ) {
              return;
            }
  
            /*
              Prefer Invoice Amount when a real
              invoice exists.
  
              Otherwise use Job Amount as the
              explicit amount owed.
  
              We never guess the amount owed.
            */
  
            const invoiceAmount =
              parseMoney(
                row["Invoice Amount"]
              );
  
            const jobAmount =
              parseMoney(
                row["Job Amount"]
              );
  
            let amountOwed:
              number | null = null;
  
            let amountSource:
              "Invoice Amount" |
              "Job Amount" |
              null = null;
  
            if (
              invoiceAmount !== null &&
              invoiceAmount > 0
            ) {
              amountOwed =
                invoiceAmount;
  
              amountSource =
                "Invoice Amount";
            } else if (
              jobAmount !== null &&
              jobAmount > 0
            ) {
              amountOwed =
                jobAmount;
  
              amountSource =
                "Job Amount";
            }
  
            /*
              No explicit amount owed means
              there is not enough evidence to
              confirm an overpayment.
            */
  
            if (
              amountOwed === null ||
              amountSource === null
            ) {
              return;
            }
  
            /*
              Equal payment or underpayment
              is not an overpayment.
            */
  
            if (
              amountPaid <=
              amountOwed
            ) {
              return;
            }
  
            const overpaidAmount =
              Number(
                (
                  amountPaid -
                  amountOwed
                ).toFixed(2)
              );
  
            if (
              overpaidAmount <= 0
            ) {
              return;
            }
  
            const paymentStatus =
              cleanText(
                row["Payment Status"]
              );
  
            leaks.push({
              detectorId:
                "universal.overpayment",
  
              leakType:
                "Overpayment",
  
              title:
                "Customer overpayment detected",
  
              description:
                `${customerName} paid $${amountPaid.toFixed(
                  2
                )} against an amount owed of $${amountOwed.toFixed(
                  2
                )}, creating a $${overpaidAmount.toFixed(
                  2
                )} customer credit or refund liability.`,
  
              category:
                "Billing",
  
              severity:
                overpaidAmount >= 1000
                  ? "high"
                  : overpaidAmount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                overpaidAmount,
  
              /*
                This is money that may need to
                be refunded or credited rather
                than revenue the business can
                recover.
  
                Therefore recoverable revenue
                is intentionally zero.
              */
  
              estimatedRecovery:
                0,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                amountOwed,
  
                amountPaid,
  
                overpaidAmount,
  
                amountSource,
  
                invoiceAmount,
  
                jobAmount,
  
                paymentStatus,
  
                status:
                  cleanText(status),
  
                jobStatus:
                  cleanText(
                    jobStatus
                  ),
              },
  
              recommendedAction:
                "Verify the payment against the invoice or completed job. If the customer was overcharged, issue the appropriate refund or account credit and correct the payment record.",
  
              metadata: {
                amountSource,
  
                liabilityType:
                  "customer_credit_or_refund",
              },
            });
          }
        );
  
        return {
          detectorId:
            "universal.overpayment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };