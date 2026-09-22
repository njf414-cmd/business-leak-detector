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
  return ["lapsed","expired","inactive","cancelled"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["reactivated","renewed","paid","collected"].includes(normalizeText(value));
}

export const lapsedMembershipDetector: BusinessLeakDetector = {
  id: "subscription-services.lapsed-membership",
  name: "Lapsed Membership",
  description: "Detects lapsed memberships with a documented recoverable renewal amount.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership","Lapsed Membership Amount","Membership Status","Membership Recovery Status","Membership Lapsed Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Status"])) return;
      if (isAlreadyBilled(row["Membership Recovery Status"])) return;

      const amount = parseMoney(row["Lapsed Membership Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Membership Lapsed Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.lapsed-membership",
        leakType: "Lapsed Membership",
        title: `${customerName} has a lapsed membership`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Membership Revenue",
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
          billingStatus: cleanText(row["Membership Recovery Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "lapsed_membership",
          detectionReason: "membership_lapsed_not_recovered",
        },
      });
    });

    return {
      detectorId: "subscription-services.lapsed-membership",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
