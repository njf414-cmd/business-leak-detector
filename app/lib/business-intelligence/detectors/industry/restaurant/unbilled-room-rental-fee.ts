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
  return ["completed","used","held","finished"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledRoomRentalFeeDetector: BusinessLeakDetector = {
  id: "restaurant.unbilled-room-rental-fee",
  name: "Unbilled Room Rental Fee",
  description: "Detects completed private-room rentals with a documented room fee that was not billed.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Room Rental","Room Rental Fee","Room Rental Status","Room Rental Billing Status","Room Rental Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Room Rental Status"])) return;
      if (isAlreadyBilled(row["Room Rental Billing Status"])) return;

      const amount = parseMoney(row["Room Rental Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Room Rental"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Room Rental Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.unbilled-room-rental-fee",
        leakType: "Unbilled Room Rental Fee",
        title: `${customerName} has a unbilled room rental fee`,
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
          status: cleanText(row["Room Rental Status"]),
          billingStatus: cleanText(row["Room Rental Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "room_rental_fee",
          detectionReason: "room_rental_completed_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "restaurant.unbilled-room-rental-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
