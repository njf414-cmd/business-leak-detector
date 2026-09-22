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
  return ["renewal due","not renewed","expired","lapsed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["renewed","paid","collected","active"].includes(normalizeText(value));
}

export const unrenewedMembershipDetector: BusinessLeakDetector = {
  id: "subscription-services.unrenewed-membership",
  name: "Unrenewed Membership",
  description: "Detects memberships that reached renewal and have not been renewed or collected.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership","Membership Renewal Amount","Membership Renewal Status","Membership Renewal Billing Status","Membership Renewal Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Renewal Status"])) return;
      if (isAlreadyBilled(row["Membership Renewal Billing Status"])) return;

      const amount = parseMoney(row["Membership Renewal Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Membership Renewal Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.unrenewed-membership",
        leakType: "Unrenewed Membership",
        title: `${customerName} has a unrenewed membership`,
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
          status: cleanText(row["Membership Renewal Status"]),
          billingStatus: cleanText(row["Membership Renewal Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "membership_renewal",
          detectionReason: "membership_due_not_renewed",
        },
      });
    });

    return {
      detectorId: "subscription-services.unrenewed-membership",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
