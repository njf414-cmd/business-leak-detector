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
  return ["open","lost","disputed","needs response"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["recovered","won","reimbursed","settled"].includes(normalizeText(value));
}

export const unrecoveredChargebackDetector: BusinessLeakDetector = {
  id: "ecommerce.unrecovered-chargeback",
  name: "Unrecovered Chargeback",
  description: "Detects chargebacks with a documented disputed amount that remains unrecovered.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Chargeback","Chargeback Amount","Chargeback Status","Chargeback Recovery Status","Chargeback Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Chargeback Status"])) return;
      if (isAlreadyBilled(row["Chargeback Recovery Status"])) return;

      const amount = parseMoney(row["Chargeback Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Chargeback"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Chargeback Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.unrecovered-chargeback",
        leakType: "Unrecovered Chargeback",
        title: `${customerName} has a unrecovered chargeback`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Ecommerce Revenue",
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
          status: cleanText(row["Chargeback Status"]),
          billingStatus: cleanText(row["Chargeback Recovery Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "chargeback",
          detectionReason: "chargeback_not_recovered",
        },
      });
    });

    return {
      detectorId: "ecommerce.unrecovered-chargeback",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
