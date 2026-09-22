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
  return ["activated","active","approved","completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedFitnessMembershipEnrollmentFeeDetector: BusinessLeakDetector = {
  id: "health-fitness.uncollected-membership-enrollment-fee",
  name: "Uncollected Membership Enrollment Fee",
  description: "Detects activated gym or fitness memberships with a documented enrollment fee that remains uncollected.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership Enrollment","Enrollment Fee Amount","Membership Enrollment Status","Enrollment Fee Status","Enrollment Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Enrollment Status"])) return;
      if (isAlreadyBilled(row["Enrollment Fee Status"])) return;

      const amount = parseMoney(row["Enrollment Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership Enrollment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Enrollment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.uncollected-membership-enrollment-fee",
        leakType: "Uncollected Membership Enrollment Fee",
        title: `${customerName} has a uncollected membership enrollment fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Fitness Billing",
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
          status: cleanText(row["Membership Enrollment Status"]),
          billingStatus: cleanText(row["Enrollment Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "membership_enrollment_fee",
          detectionReason: "membership_activated_enrollment_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "health-fitness.uncollected-membership-enrollment-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
