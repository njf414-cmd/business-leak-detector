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
  return ["frozen","paused","on hold","freeze active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","included"].includes(normalizeText(value));
}

export const uncollectedMembershipFreezeFeeDetector: BusinessLeakDetector = {
  id: "health-fitness.uncollected-membership-freeze-fee",
  name: "Uncollected Membership Freeze / Hold Fee",
  description: "Detects frozen or paused memberships with a documented hold fee that remains uncollected.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership Freeze","Membership Freeze Fee","Membership Freeze Status","Membership Freeze Fee Status","Freeze Start Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Freeze Status"])) return;
      if (isAlreadyBilled(row["Membership Freeze Fee Status"])) return;

      const amount = parseMoney(row["Membership Freeze Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership Freeze"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Freeze Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.uncollected-membership-freeze-fee",
        leakType: "Uncollected Membership Freeze / Hold Fee",
        title: `${customerName} has a uncollected membership freeze / hold fee`,
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
          status: cleanText(row["Membership Freeze Status"]),
          billingStatus: cleanText(row["Membership Freeze Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "membership_freeze_fee",
          detectionReason: "membership_frozen_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "health-fitness.uncollected-membership-freeze-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
