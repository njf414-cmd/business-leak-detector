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
  return ["assessed","confirmed","approved","fee due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedHospitalityDamageFeeDetector: BusinessLeakDetector = {
  id: "hospitality.uncollected-damage-fee",
  name: "Uncollected Damage Fee",
  description: "Detects documented uncollected damage fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["hospitality"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Damage Charge","Damage Fee Amount","Damage Status","Damage Fee Status","Assessment Date"],
  },
  supports(profile) {
    return profile.industry === "hospitality";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Damage Status"])) return;
      if (isAlreadyBilled(row["Damage Fee Status"])) return;

      const amount = parseMoney(row["Damage Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Damage Charge"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Assessment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "hospitality.uncollected-damage-fee",
        leakType: "Uncollected Damage Fee",
        title: `${customerName} has a uncollected damage fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Hospitality Billing",
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
          status: cleanText(row["Damage Status"]),
          billingStatus: cleanText(row["Damage Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "hospitality",
          revenueType: "damage_fee",
          detectionReason: "hospitality_damage_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "hospitality.uncollected-damage-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
