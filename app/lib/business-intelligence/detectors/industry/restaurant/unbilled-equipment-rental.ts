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
  return ["rented","provided","used","completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledRestaurantEquipmentRentalDetector: BusinessLeakDetector = {
  id: "restaurant.unbilled-equipment-rental",
  name: "Unbilled Equipment Rental",
  description: "Detects catering or event equipment rentals with a documented rental amount that was not billed.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Equipment Rental","Equipment Rental Amount","Equipment Rental Status","Equipment Rental Billing Status","Rental Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Equipment Rental Status"])) return;
      if (isAlreadyBilled(row["Equipment Rental Billing Status"])) return;

      const amount = parseMoney(row["Equipment Rental Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Equipment Rental"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Rental Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.unbilled-equipment-rental",
        leakType: "Unbilled Equipment Rental",
        title: `${customerName} has a unbilled equipment rental`,
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
          status: cleanText(row["Equipment Rental Status"]),
          billingStatus: cleanText(row["Equipment Rental Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "equipment_rental",
          detectionReason: "restaurant_equipment_rental_not_billed",
        },
      });
    });

    return {
      detectorId: "restaurant.unbilled-equipment-rental",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
