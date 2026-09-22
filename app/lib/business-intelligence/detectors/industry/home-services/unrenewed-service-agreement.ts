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
  
  function agreementRenewed(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "renewed",
      "active",
      "paid",
      "extended",
      "auto renewed",
      "autorenewed",
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
  /* DETECTOR #41 */
  /* ================================== */
  
  export const unrenewedServiceAgreementDetector:
    BusinessLeakDetector = {
      id:
        "home-services.unrenewed-service-agreement",
  
      name:
        "Unrenewed Service Agreement",
  
      description:
        "Detects home-service customers whose documented service or maintenance agreement is due for renewal but has not been renewed.",
  
      scope:
        "industry",
  
      industries: [
        "home_services",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Service Agreement",
          "Agreement Renewal Date",
          "Agreement Renewal Amount",
          "Agreement Status",
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
            const renewalDate =
              parseDate(
                row[
                  "Agreement Renewal Date"
                ]
              );
  
            /*
              Require an explicit renewal
              date. Never guess when an
              agreement should renew.
            */
  
            if (!renewalDate) {
              return;
            }
  
            /*
              The renewal must already be
              due. Future renewals are not
              revenue leaks yet.
            */
  
            if (
              renewalDate.getTime() >
              context.now.getTime()
            ) {
              return;
            }
  
            /*
              If the agreement is already
              renewed or active, there is
              no leak.
            */
  
            if (
              agreementRenewed(
                row[
                  "Agreement Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Agreement Renewal Amount"
                ]
              );
  
            /*
              Require an explicit renewal
              value.
  
              Never substitute Job Amount,
              Invoice Amount, Maintenance
              Amount, or another field.
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
                  renewalDate,
                  context.now
                )
              );
  
            /*
              Renewal revenue is valuable
              but not guaranteed, so use
              a conservative recovery
              estimate.
            */
  
            const recovery =
              amount * 0.5;
  
            leaks.push({
              detectorId:
                "home-services.unrenewed-service-agreement",
  
              leakType:
                "Unrenewed Service Agreement",
  
              title:
                `${customerName}'s ${agreement} has not been renewed`,
  
              description:
                `${customerName}'s ${agreement} renewal is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue, representing $${amount.toFixed(
                  2
                )} in potential recurring revenue.`,
  
              category:
                "Home Services Retention",
  
              severity:
                amount >= 2500 ||
                daysOverdue >= 120
                  ? "high"
                  : amount >= 750 ||
                      daysOverdue >= 45
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
  
                agreementRenewalDate:
                  renewalDate.toISOString(),
  
                agreementRenewalAmount:
                  amount,
  
                agreementStatus:
                  cleanText(
                    row[
                      "Agreement Status"
                    ]
                  ),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Contact ${customerName} about renewing their ${agreement} and attempt to recover the $${amount.toFixed(
                  2
                )} renewal opportunity.`,
  
              metadata: {
                industry:
                  "home_services",
  
                revenueType:
                  "service_agreement_renewal",
  
                detectionReason:
                  "service_agreement_due_not_renewed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "home-services.unrenewed-service-agreement",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };