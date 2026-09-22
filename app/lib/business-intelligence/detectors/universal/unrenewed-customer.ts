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
  /* RENEWAL STATUS RULES */
  /* ================================== */
  
  /*
    These explicitly tell us a renewal
    was expected but did not happen.
  */
  
  const MISSED_RENEWAL_STATUSES = [
    "not renewed",
    "unrenewed",
    "renewal missed",
    "missed renewal",
    "renewal overdue",
    "overdue renewal",
    "renewal past due",
    "past due",
    "renewal due",
    "due",
    "pending renewal",
    "renewal pending",
    "awaiting renewal",
    "needs renewal",
    "renewal required",
  ];
  
  /*
    These explicitly indicate that the
    renewal was successfully completed.
  */
  
  const COMPLETED_RENEWAL_STATUSES = [
    "renewed",
    "renewal complete",
    "renewal completed",
    "renewal successful",
    "successfully renewed",
    "active renewed",
  ];
  
  /*
    These indicate the relationship was
    intentionally ended rather than a
    renewal being accidentally missed.
  
    We do NOT automatically call these
    recoverable renewal leaks.
  */
  
  const TERMINATED_STATUSES = [
    "cancelled",
    "canceled",
    "terminated",
    "closed",
    "customer cancelled",
    "customer canceled",
    "opted out",
    "declined renewal",
    "renewal declined",
  ];
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unrenewedCustomerDetector:
    BusinessLeakDetector = {
      id:
        "universal.unrenewed-customer",
  
      name:
        "Unrenewed Customer",
  
      description:
        "Detects memberships, subscriptions, contracts, plans, or service agreements that reached renewal but were not renewed.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Renewal Amount",
          "Renewal Date",
          "Renewal Status",
          "Recurring Status",
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
  
            const renewalAmount =
              parseMoney(
                row["Renewal Amount"]
              );
  
            /*
              Safety rule:
  
              Renewal value must be explicit.
  
              Never substitute:
              - Recurring Amount
              - Invoice Amount
              - Job Amount
              - Quote Amount
  
              Those amounts may represent
              completely different revenue.
            */
  
            if (
              renewalAmount === null ||
              renewalAmount <= 0
            ) {
              return;
            }
  
            const renewalStatus =
              row["Renewal Status"];
  
            const recurringStatus =
              row["Recurring Status"];
  
            const generalStatus =
              row["Status"];
  
            /* ================================== */
            /* ALREADY RENEWED */
            /* ================================== */
  
            if (
              matchesStatus(
                renewalStatus,
                COMPLETED_RENEWAL_STATUSES
              )
            ) {
              return;
            }
  
            /* ================================== */
            /* INTENTIONAL TERMINATION */
            /* ================================== */
  
            const intentionallyTerminated =
              matchesStatus(
                renewalStatus,
                TERMINATED_STATUSES
              );
  
            if (
              intentionallyTerminated
            ) {
              return;
            }
  
            /* ================================== */
            /* EXPLICIT MISSED RENEWAL */
            /* ================================== */
  
            const explicitMissedRenewal =
              matchesStatus(
                renewalStatus,
                MISSED_RENEWAL_STATUSES
              );
  
            /* ================================== */
            /* RENEWAL DATE */
            /* ================================== */
  
            const renewalDate =
              parseDate(
                row["Renewal Date"]
              );
  
            const renewalDateHasPassed =
              renewalDate !== null &&
              renewalDate.getTime() <
                context.now.getTime();
  
            /*
              We need evidence that this was
              actually an ongoing relationship.
  
              This prevents a random old record
              with a date from becoming a
              "missed renewal."
            */
  
            const ongoingRelationship =
              matchesStatus(
                recurringStatus,
                [
                  "active",
                  "current",
                  "enabled",
                  "recurring",
                  "subscription active",
                  "membership active",
                  "plan active",
                  "contract active",
                  "agreement active",
                ]
              ) ||
              matchesStatus(
                generalStatus,
                [
                  "active",
                  "current",
                  "member",
                  "customer",
                  "contract active",
                  "membership active",
                  "subscription active",
                ]
              );
  
            /*
              Confirmed leak paths:
  
              1. Explicit renewal status says the
                 renewal is missing/due.
  
              OR
  
              2. Explicit renewal date passed AND
                 the customer relationship is
                 explicitly still active.
  
              Future renewal dates never trigger.
            */
  
            const missedByDate =
              renewalDateHasPassed &&
              ongoingRelationship;
  
            if (
              !explicitMissedRenewal &&
              !missedByDate
            ) {
              return;
            }
  
            /* ================================== */
            /* CREATE FINDING */
            /* ================================== */
  
            leaks.push({
              detectorId:
                "universal.unrenewed-customer",
  
              leakType:
                "Unrenewed Customer",
  
              title:
                "Customer renewal was missed",
  
              description:
                `${customerName} has a $${renewalAmount.toFixed(
                  2
                )} renewal that appears to have reached its renewal point without being renewed.`,
  
              category:
                "Recurring Revenue",
  
              severity:
                renewalAmount >= 1500
                  ? "high"
                  : renewalAmount >= 750
                    ? "medium"
                    : "low",
  
              confidence:
                explicitMissedRenewal
                  ? "high"
                  : "medium",
  
              estimatedLoss:
                renewalAmount,
  
              estimatedRecovery:
                renewalAmount,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                renewalAmount,
  
                renewalStatus:
                  cleanText(
                    renewalStatus
                  ),
  
                renewalDate:
                  cleanText(
                    row[
                      "Renewal Date"
                    ]
                  ),
  
                recurringStatus:
                  cleanText(
                    recurringStatus
                  ),
  
                status:
                  cleanText(
                    generalStatus
                  ),
  
                renewalDateHasPassed,
  
                ongoingRelationship,
  
                explicitMissedRenewal,
  
                missedByDate,
              },
  
              recommendedAction:
                "Confirm the customer is still eligible for renewal, contact them with the renewal offer, resolve any renewal issue, and update the membership, subscription, contract, or service agreement status.",
  
              metadata: {
                revenueType:
                  "renewal",
  
                amountSource:
                  "Renewal Amount",
  
                detectionReason:
                  explicitMissedRenewal
                    ? "explicit_missed_renewal_status"
                    : "active_relationship_past_renewal_date",
              },
            });
          }
        );
  
        return {
          detectorId:
            "universal.unrenewed-customer",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };