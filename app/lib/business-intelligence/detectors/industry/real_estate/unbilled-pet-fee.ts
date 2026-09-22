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
  return ["approved","registered","active","added"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledPetFeeDetector: BusinessLeakDetector = {
  id: "real-estate.unbilled-pet-fee",
  name: "Unbilled Pet Fee",
  description: "Detects approved tenant pet fees with documented amounts that have not been billed.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Pet","Pet Fee Amount","Pet Status","Pet Fee Billing Status","Pet Approval Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Pet Status"])) return;
      if (isAlreadyBilled(row["Pet Fee Billing Status"])) return;

      const amount = parseMoney(row["Pet Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Pet"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Pet Approval Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.unbilled-pet-fee",
        leakType: "Unbilled Pet Fee",
        title: `${customerName} has a unbilled pet fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Real Estate Billing",
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
          status: cleanText(row["Pet Status"]),
          billingStatus: cleanText(row["Pet Fee Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "pet_fee",
          detectionReason: "approved_pet_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "real-estate.unbilled-pet-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
