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
  return ["completed","earned","applicable","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","included","paid","collected"].includes(normalizeText(value));
}

export const unbilledRestaurantServiceChargeDetector: BusinessLeakDetector = {
  id: "restaurant.unbilled-service-charge",
  name: "Unbilled Service Charge",
  description: "Detects completed restaurant checks or events with a documented service charge that was not billed.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Service Charge","Service Charge Amount","Service Charge Status","Service Charge Billing Status","Service Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Service Charge Status"])) return;
      if (isAlreadyBilled(row["Service Charge Billing Status"])) return;

      const amount = parseMoney(row["Service Charge Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Service Charge"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Service Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.unbilled-service-charge",
        leakType: "Unbilled Service Charge",
        title: `${customerName} has a unbilled service charge`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Restaurant Billing",
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
          status: cleanText(row["Service Charge Status"]),
          billingStatus: cleanText(row["Service Charge Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "service_charge",
          detectionReason: "service_charge_earned_not_billed",
        },
      });
    });

    return {
      detectorId: "restaurant.unbilled-service-charge",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
