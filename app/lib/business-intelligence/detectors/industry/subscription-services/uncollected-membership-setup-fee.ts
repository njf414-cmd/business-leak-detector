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
  return ["completed","activated","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","billed","invoiced"].includes(normalizeText(value));
}

export const uncollectedMembershipSetupFeeDetector: BusinessLeakDetector = {
  id: "subscription-services.uncollected-membership-setup-fee",
  name: "Uncollected Membership Setup Fee",
  description: "Detects completed membership setup or activation events with a documented setup fee that has not been collected.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership Setup","Membership Setup Fee","Membership Setup Status","Membership Setup Fee Status","Membership Setup Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Setup Status"])) return;
      if (isAlreadyBilled(row["Membership Setup Fee Status"])) return;

      const amount = parseMoney(row["Membership Setup Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership Setup"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Membership Setup Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.uncollected-membership-setup-fee",
        leakType: "Uncollected Membership Setup Fee",
        title: `${customerName} has a uncollected membership setup fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Membership Billing",
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
          status: cleanText(row["Membership Setup Status"]),
          billingStatus: cleanText(row["Membership Setup Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "membership_setup_fee",
          detectionReason: "membership_setup_completed_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "subscription-services.uncollected-membership-setup-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
