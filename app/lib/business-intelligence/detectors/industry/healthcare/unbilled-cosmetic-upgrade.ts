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
  return ["completed","performed","provided","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledCosmeticUpgradeDetector: BusinessLeakDetector = {
  id: "healthcare.unbilled-cosmetic-upgrade",
  name: "Unbilled Cosmetic Upgrade",
  description: "Detects completed cosmetic treatment upgrades with a documented additional amount that has not been billed.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Cosmetic Upgrade","Cosmetic Upgrade Amount","Cosmetic Upgrade Status","Cosmetic Upgrade Billing Status","Treatment Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Cosmetic Upgrade Status"])) return;
      if (isAlreadyBilled(row["Cosmetic Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Cosmetic Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Cosmetic Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Treatment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.unbilled-cosmetic-upgrade",
        leakType: "Unbilled Cosmetic Upgrade",
        title: `${customerName} has a unbilled cosmetic upgrade`,
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
          status: cleanText(row["Cosmetic Upgrade Status"]),
          billingStatus: cleanText(row["Cosmetic Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "cosmetic_upgrade",
          detectionReason: "cosmetic_upgrade_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "healthcare.unbilled-cosmetic-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
