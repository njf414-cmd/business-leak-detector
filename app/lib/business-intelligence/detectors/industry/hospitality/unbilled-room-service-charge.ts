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
  return ["delivered","completed","served","provided"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledHospitalityRoomServiceChargeDetector: BusinessLeakDetector = {
  id: "hospitality.unbilled-room-service-charge",
  name: "Unbilled Room Service Charge",
  description: "Detects documented unbilled room service charge opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["hospitality"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Room Service","Room Service Amount","Room Service Status","Room Service Billing Status","Service Date"],
  },
  supports(profile) {
    return profile.industry === "hospitality";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Room Service Status"])) return;
      if (isAlreadyBilled(row["Room Service Billing Status"])) return;

      const amount = parseMoney(row["Room Service Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Room Service"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Service Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "hospitality.unbilled-room-service-charge",
        leakType: "Unbilled Room Service Charge",
        title: `${customerName} has a unbilled room service charge`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Hospitality Billing",
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
          status: cleanText(row["Room Service Status"]),
          billingStatus: cleanText(row["Room Service Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "hospitality",
          revenueType: "room_service_charge",
          detectionReason: "hospitality_room_service_not_billed",
        },
      });
    });

    return {
      detectorId: "hospitality.unbilled-room-service-charge",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
