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
  return ["completed","delivered","expedited","performed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledAgencyRushFeeDetector: BusinessLeakDetector = {
  id: "agency.unbilled-rush-fee",
  name: "Unbilled Rush Fee",
  description: "Detects documented unbilled rush fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["agency"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Rush Work","Rush Fee","Rush Work Status","Rush Fee Billing Status","Delivery Date"],
  },
  supports(profile) {
    return profile.industry === "agency";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Rush Work Status"])) return;
      if (isAlreadyBilled(row["Rush Fee Billing Status"])) return;

      const amount = parseMoney(row["Rush Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Rush Work"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Delivery Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "agency.unbilled-rush-fee",
        leakType: "Unbilled Rush Fee",
        title: `${customerName} has a unbilled rush fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Agency Billing",
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
          status: cleanText(row["Rush Work Status"]),
          billingStatus: cleanText(row["Rush Fee Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "agency",
          revenueType: "rush_fee",
          detectionReason: "agency_rush_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "agency.unbilled-rush-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
