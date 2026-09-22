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
  return ["active","assigned","rented","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","billed","included"].includes(normalizeText(value));
}

export const uncollectedLockerRentalFeeDetector: BusinessLeakDetector = {
  id: "health-fitness.uncollected-locker-rental-fee",
  name: "Uncollected Locker Rental Fee",
  description: "Detects active locker rentals with a documented rental fee that remains uncollected.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Locker Rental","Locker Rental Fee","Locker Rental Status","Locker Rental Payment Status","Locker Rental Start Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Locker Rental Status"])) return;
      if (isAlreadyBilled(row["Locker Rental Payment Status"])) return;

      const amount = parseMoney(row["Locker Rental Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Locker Rental"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Locker Rental Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.uncollected-locker-rental-fee",
        leakType: "Uncollected Locker Rental Fee",
        title: `${customerName} has a uncollected locker rental fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Fitness Billing",
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
          status: cleanText(row["Locker Rental Status"]),
          billingStatus: cleanText(row["Locker Rental Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "locker_rental_fee",
          detectionReason: "locker_rental_active_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "health-fitness.uncollected-locker-rental-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
