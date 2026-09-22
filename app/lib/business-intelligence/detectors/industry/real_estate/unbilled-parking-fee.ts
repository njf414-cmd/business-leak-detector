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
  return ["assigned","active","approved","occupied"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledParkingFeeDetector: BusinessLeakDetector = {
  id: "real-estate.unbilled-parking-fee",
  name: "Unbilled Parking Fee",
  description: "Detects assigned or active paid parking with documented charges that have not been billed.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Parking Space","Parking Fee Amount","Parking Status","Parking Billing Status","Parking Start Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Parking Status"])) return;
      if (isAlreadyBilled(row["Parking Billing Status"])) return;

      const amount = parseMoney(row["Parking Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Parking Space"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Parking Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.unbilled-parking-fee",
        leakType: "Unbilled Parking Fee",
        title: `${customerName} has a unbilled parking fee`,
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
          status: cleanText(row["Parking Status"]),
          billingStatus: cleanText(row["Parking Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "parking_fee",
          detectionReason: "active_parking_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "real-estate.unbilled-parking-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
