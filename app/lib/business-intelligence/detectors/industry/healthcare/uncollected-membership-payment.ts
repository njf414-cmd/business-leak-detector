import type {
  BusinessLeakDetector,
  DetectorContext,
  DetectorResult,
  DetectedBusinessLeak,
} from "../../../detector-types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseMoney(value: unknown): number | null {
  const cleaned = cleanText(value).replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEarned(value: unknown): boolean {
  return ["active","payment due","past due","delinquent"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","settled"].includes(normalizeText(value));
}

export const uncollectedHealthcareMembershipPaymentDetector: BusinessLeakDetector = {
  id: "healthcare.uncollected-membership-payment",
  name: "Uncollected Membership Payment",
  description: "Detects active healthcare or med-spa memberships with a documented payment amount that remains uncollected.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership","Membership Payment Amount","Membership Status","Membership Payment Status","Membership Payment Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Status"])) return;
      if (isAlreadyBilled(row["Membership Payment Status"])) return;

      const amount = parseMoney(row["Membership Payment Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Membership Payment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.uncollected-membership-payment",
        leakType: "Uncollected Membership Payment",
        title: `${customerName} has a uncollected membership payment`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Healthcare Billing",
        severity: amount >= 25000 ? "high" : amount >= 7500 ? "medium" : "low",
        confidence: "high",
        estimatedLoss: amount,
        estimatedRecovery: recovery,
        customerName,
        sourceRowIndex: rowIndex,
        evidence: {
          projectName,
          item,
          amount,
          status: cleanText(row["Membership Status"]),
          billingStatus: cleanText(row["Membership Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "membership_payment",
          detectionReason: "healthcare_membership_payment_not_collected",
        },
      });
    });

    return {
      detectorId: "healthcare.uncollected-membership-payment",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
