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
  
  function hasValue(
    value: unknown
  ): boolean {
    return (
      value !== null &&
      value !== undefined &&
      cleanText(value) !== ""
    );
  }
  
  function normalizeDate(
    value: unknown
  ): string | null {
    const text = cleanText(value);
  
    if (!text) {
      return null;
    }
  
    const parsed = new Date(text);
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed
      .toISOString()
      .slice(0, 10);
  }
  
  function isDeadStatus(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "cancelled",
      "canceled",
      "void",
      "voided",
      "refunded",
      "refund",
      "failed",
      "declined",
    ].includes(status);
  }
  
  /* ================================== */
  /* DUPLICATE SIGNATURE */
  /* ================================== */
  
  /*
    This detector is intentionally strict.
  
    Two records are only considered confirmed
    duplicate charges when we have:
  
    1. Same known customer
    2. Same positive amount
    3. Same valid date
    4. Neither record is cancelled/refunded/
       failed/voided
  
    This prevents ordinary repeat purchases
    from being called duplicate charges.
  */
  
  type ChargeCandidate = {
    rowIndex: number;
    customerName: string;
    amount: number;
    date: string;
    paymentStatus: string;
    status: string;
  };
  
  function buildSignature(
    candidate: ChargeCandidate
  ): string {
    return [
      normalizeText(
        candidate.customerName
      ),
      candidate.amount.toFixed(2),
      candidate.date,
    ].join("::");
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const duplicateChargeDetector:
    BusinessLeakDetector = {
      id:
        "universal.duplicate-charge",
  
      name:
        "Duplicate Charge",
  
      description:
        "Detects highly likely duplicate customer charges when the same customer has the same positive payment amount recorded on the same date.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Amount Paid",
          "Invoice Amount",
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
  
        const candidates:
          ChargeCandidate[] = [];
  
        /* ================================== */
        /* BUILD SAFE CHARGE CANDIDATES */
        /* ================================== */
  
        context.rows.forEach(
          (row, rowIndex) => {
            const customerName =
              cleanText(
                row["Customer Name"]
              );
  
            /*
              We cannot safely identify a
              duplicate without a known
              customer.
            */
  
            if (!customerName) {
              return;
            }
  
            /*
              Amount Paid is preferred because
              this detector is looking for an
              actual duplicated charge/payment,
              not merely two invoices with the
              same value.
            */
  
            if (
              !hasValue(
                row["Amount Paid"]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row["Amount Paid"]
              );
  
            if (amount <= 0) {
              return;
            }
  
            const date =
              normalizeDate(
                row["Date"]
              );
  
            /*
              Same-day evidence is required.
  
              Missing or invalid dates are not
              enough to confirm a duplicate.
            */
  
            if (!date) {
              return;
            }
  
            const paymentStatus =
              cleanText(
                row["Payment Status"]
              );
  
            const status =
              cleanText(
                row["Status"]
              );
  
            /*
              Failed, voided, cancelled, or
              refunded transactions should not
              be treated as successful duplicate
              charges.
            */
  
            if (
              isDeadStatus(
                paymentStatus
              ) ||
              isDeadStatus(
                status
              )
            ) {
              return;
            }
  
            candidates.push({
              rowIndex,
              customerName,
              amount,
              date,
              paymentStatus,
              status,
            });
          }
        );
  
        /* ================================== */
        /* GROUP POSSIBLE DUPLICATES */
        /* ================================== */
  
        const groups =
          new Map<
            string,
            ChargeCandidate[]
          >();
  
        for (
          const candidate of candidates
        ) {
          const signature =
            buildSignature(
              candidate
            );
  
          const existing =
            groups.get(signature) ??
            [];
  
          existing.push(
            candidate
          );
  
          groups.set(
            signature,
            existing
          );
        }
  
        /* ================================== */
        /* CREATE CONFIRMED FINDINGS */
        /* ================================== */
  
        for (
          const group of groups.values()
        ) {
          if (group.length < 2) {
            continue;
          }
  
          /*
            The first matching transaction is
            treated as the legitimate payment.
  
            Every additional identical payment
            is treated as the amount potentially
            duplicated.
  
            Example:
  
            2 identical $500 charges
            = $500 duplicate exposure.
  
            3 identical $500 charges
            = $1,000 duplicate exposure.
          */
  
          const original =
            group[0];
  
          const duplicateCount =
            group.length - 1;
  
          const duplicateAmount =
            original.amount *
            duplicateCount;
  
          const duplicateRowIndexes =
            group
              .slice(1)
              .map(
                (candidate) =>
                  candidate.rowIndex
              );
  
          leaks.push({
            detectorId:
              "universal.duplicate-charge",
  
            leakType:
              "Duplicate Charge",
  
            title:
              "Possible duplicate customer charge",
  
            description:
              `${original.customerName} has ${group.length} matching $${original.amount.toFixed(
                2
              )} payments recorded on ${original.date}, creating $${duplicateAmount.toFixed(
                2
              )} of possible duplicate charges.`,
  
            category:
              "Billing",
  
            severity:
              duplicateAmount >= 1000
                ? "high"
                : duplicateAmount >= 500
                  ? "medium"
                  : "low",
  
            /*
              Even with strict matching, two
              legitimate same-day purchases can
              occasionally have the same value.
  
              Therefore this remains medium
              confidence until transaction IDs
              or invoice IDs are available.
            */
  
            confidence:
              "medium",
  
            estimatedLoss:
              duplicateAmount,
  
            estimatedRecovery:
              duplicateAmount,
  
            customerName:
              original.customerName,
  
            sourceRowIndex:
              duplicateRowIndexes[0] ??
              original.rowIndex,
  
            evidence: {
              customerName:
                original.customerName,
  
              amount:
                original.amount,
  
              date:
                original.date,
  
              matchingRecordCount:
                group.length,
  
              duplicateCount,
  
              duplicateAmount,
  
              originalRowIndex:
                original.rowIndex,
  
              duplicateRowIndexes,
  
              matchingRows:
                group.map(
                  (candidate) => ({
                    rowIndex:
                      candidate.rowIndex,
  
                    amount:
                      candidate.amount,
  
                    date:
                      candidate.date,
  
                    paymentStatus:
                      candidate.paymentStatus,
  
                    status:
                      candidate.status,
                  })
                ),
            },
  
            recommendedAction:
              "Review the matching transactions and verify whether the additional charge was legitimate. If it was duplicated, refund or credit the customer and correct the payment records.",
  
            metadata: {
              matchingRecordCount:
                group.length,
  
              duplicateCount,
            },
          });
        }
  
        return {
          detectorId:
            "universal.duplicate-charge",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };