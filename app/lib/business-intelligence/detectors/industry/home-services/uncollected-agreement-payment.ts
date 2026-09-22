import type {
    BusinessLeakDetector,
    DetectorContext,
    DetectorResult,
    DetectedBusinessLeak,
  } from "../../../detector-types";
  
  /* ================================== */
  /* HELPERS */
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
  ): number | null {
    const cleaned =
      cleanText(value)
        .replace(/[$,\s]/g, "");
  
    if (
      !cleaned ||
      !/^\d+(\.\d+)?$/.test(
        cleaned
      )
    ) {
      return null;
    }
  
    const parsed =
      Number(cleaned);
  
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }
  
  function parseDate(
    value: unknown
  ): Date | null {
    const text =
      cleanText(value);
  
    if (!text) {
      return null;
    }
  
    const parsed =
      new Date(text);
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function agreementActive(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "active",
      "current",
      "enrolled",
      "renewed",
    ].includes(status);
  }
  
  function paymentCollected(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "paid",
      "collected",
      "received",
      "processed",
      "successful",
      "success",
    ].includes(status);
  }
  
  function daysBetween(
    earlier: Date,
    later: Date
  ): number {
    const milliseconds =
      later.getTime() -
      earlier.getTime();
  
    return Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    );
  }
  
  /* ================================== */
  /* DETECTOR #45 */
  /* ================================== */
  
  export const uncollectedAgreementPaymentDetector:
    BusinessLeakDetector = {
      id:
        "home-services.uncollected-agreement-payment",
  
      name:
        "Uncollected Agreement Payment",
  
      description:
        "Detects active home-service maintenance agreements or memberships with a documented payment that is due but has not been collected.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Service Agreement",
          "Agreement Status",
          "Agreement Payment Amount",
          "Agreement Payment Due Date",
          "Agreement Payment Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "home_services"
        );
      },
  
      async detect(
        context: DetectorContext
      ): Promise<DetectorResult> {
        const leaks:
          DetectedBusinessLeak[] = [];
  
        const warnings:
          string[] = [];
  
        const errors:
          string[] = [];
  
        context.rows.forEach(
          (
            row,
            rowIndex
          ) => {
            /*
              Only active/current
              agreements qualify.
  
              We do not treat cancelled,
              expired, or inactive plans
              as missed payments here.
            */
  
            if (
              !agreementActive(
                row[
                  "Agreement Status"
                ]
              )
            ) {
              return;
            }
  
            const dueDate =
              parseDate(
                row[
                  "Agreement Payment Due Date"
                ]
              );
  
            /*
              Require an explicit payment
              due date.
  
              Never guess when a membership
              payment should occur.
            */
  
            if (!dueDate) {
              return;
            }
  
            /*
              Future payments are not
              revenue leaks yet.
            */
  
            if (
              dueDate.getTime() >
              context.now.getTime()
            ) {
              return;
            }
  
            /*
              If the payment was already
              collected, there is no leak.
            */
  
            if (
              paymentCollected(
                row[
                  "Agreement Payment Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Agreement Payment Amount"
                ]
              );
  
            /*
              Require the explicit payment
              amount.
  
              Never substitute Renewal
              Amount, Invoice Amount,
              Job Amount, or another
              monetary field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const agreement =
              cleanText(
                row[
                  "Service Agreement"
                ]
              );
  
            if (!agreement) {
              return;
            }
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const daysOverdue =
              Math.max(
                0,
                daysBetween(
                  dueDate,
                  context.now
                )
              );
  
            /*
              This is an existing active
              customer with a documented
              payment obligation, so the
              recovery probability is
              relatively strong.
            */
  
            const recovery =
              amount * 0.75;
  
            leaks.push({
              detectorId:
                "home-services.uncollected-agreement-payment",
  
              leakType:
                "Uncollected Agreement Payment",
  
              title:
                `${customerName} has an uncollected ${agreement} payment`,
  
              description:
                `${customerName}'s $${amount.toFixed(
                  2
                )} payment for ${agreement} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue and has not been collected.`,
  
              category:
                "Home Services Recurring Revenue",
  
              severity:
                amount >= 1000 ||
                daysOverdue >= 90
                  ? "high"
                  : amount >= 300 ||
                      daysOverdue >= 30
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                amount,
  
              estimatedRecovery:
                recovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                serviceAgreement:
                  agreement,
  
                agreementStatus:
                  cleanText(
                    row[
                      "Agreement Status"
                    ]
                  ),
  
                agreementPaymentAmount:
                  amount,
  
                agreementPaymentDueDate:
                  dueDate.toISOString(),
  
                agreementPaymentStatus:
                  cleanText(
                    row[
                      "Agreement Payment Status"
                    ]
                  ),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Contact ${customerName} about the overdue $${amount.toFixed(
                  2
                )} ${agreement} payment and attempt to collect the outstanding balance.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "agreement_payment",
  
                detectionReason:
                  "active_agreement_payment_due_not_collected",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.uncollected-agreement-payment",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };