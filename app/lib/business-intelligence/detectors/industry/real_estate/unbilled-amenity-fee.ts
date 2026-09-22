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
  return ["active","approved","activated","provided"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledAmenityFeeDetector: BusinessLeakDetector = {
  id: "real-estate.unbilled-amenity-fee",
  name: "Unbilled Amenity Fee",
  description: "Detects activated or approved paid amenities with documented fees that have not been billed.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Amenity","Amenity Fee Amount","Amenity Status","Amenity Billing Status","Amenity Start Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Amenity Status"])) return;
      if (isAlreadyBilled(row["Amenity Billing Status"])) return;

      const amount = parseMoney(row["Amenity Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Amenity"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Amenity Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.unbilled-amenity-fee",
        leakType: "Unbilled Amenity Fee",
        title: `${customerName} has a unbilled amenity fee`,
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
          status: cleanText(row["Amenity Status"]),
          billingStatus: cleanText(row["Amenity Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "amenity_fee",
          detectionReason: "active_amenity_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "real-estate.unbilled-amenity-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
