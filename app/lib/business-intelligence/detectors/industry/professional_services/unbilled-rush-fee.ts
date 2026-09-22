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
  return ["completed","performed","delivered","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledProfessionalRushFeeDetector: BusinessLeakDetector = {
  id: "professional-services.unbilled-rush-fee",
  name: "Unbilled Rush Fee",
  description: "Detects completed rush or expedited professional work with a documented rush fee that has not been billed.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Rush Service","Rush Fee","Rush Service Status","Rush Fee Billing Status","Rush Service Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Rush Service Status"])) return;
      if (isAlreadyBilled(row["Rush Fee Billing Status"])) return;

      const amount = parseMoney(row["Rush Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Rush Service"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Rush Service Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.unbilled-rush-fee",
        leakType: "Unbilled Rush Fee",
        title: `${customerName} has a unbilled rush fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Professional Services Billing",
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
          status: cleanText(row["Rush Service Status"]),
          billingStatus: cleanText(row["Rush Fee Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "rush_fee",
          detectionReason: "rush_service_completed_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "professional-services.unbilled-rush-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
