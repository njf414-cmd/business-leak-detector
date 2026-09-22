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
  return ["completed","expedited","fulfilled","provided"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledRetailExpeditedServiceFeeDetector: BusinessLeakDetector = {
  id: "retail.unbilled-expedited-service-fee",
  name: "Unbilled Expedited Service Fee",
  description: "Detects documented unbilled expedited service fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["retail"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Expedited Service","Expedited Service Fee","Expedited Service Status","Expedited Service Billing Status","Service Date"],
  },
  supports(profile) {
    return profile.industry === "retail";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Expedited Service Status"])) return;
      if (isAlreadyBilled(row["Expedited Service Billing Status"])) return;

      const amount = parseMoney(row["Expedited Service Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Expedited Service"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Service Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "retail.unbilled-expedited-service-fee",
        leakType: "Unbilled Expedited Service Fee",
        title: `${customerName} has a unbilled expedited service fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Retail Billing",
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
          status: cleanText(row["Expedited Service Status"]),
          billingStatus: cleanText(row["Expedited Service Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "retail",
          revenueType: "expedited_service_fee",
          detectionReason: "retail_expedited_service_not_billed",
        },
      });
    });

    return {
      detectorId: "retail.unbilled-expedited-service-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
