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
  return ["completed","held","hosted","finished"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledHospitalityEventSpaceFeeDetector: BusinessLeakDetector = {
  id: "hospitality.unbilled-event-space-fee",
  name: "Unbilled Event Space Fee",
  description: "Detects documented unbilled event space fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["hospitality"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Event Space","Event Space Fee","Event Status","Event Space Billing Status","Event Date"],
  },
  supports(profile) {
    return profile.industry === "hospitality";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Event Status"])) return;
      if (isAlreadyBilled(row["Event Space Billing Status"])) return;

      const amount = parseMoney(row["Event Space Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Event Space"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Event Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "hospitality.unbilled-event-space-fee",
        leakType: "Unbilled Event Space Fee",
        title: `${customerName} has a unbilled event space fee`,
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
          status: cleanText(row["Event Status"]),
          billingStatus: cleanText(row["Event Space Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "hospitality",
          revenueType: "event_space_fee",
          detectionReason: "hospitality_event_space_not_billed",
        },
      });
    });

    return {
      detectorId: "hospitality.unbilled-event-space-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
