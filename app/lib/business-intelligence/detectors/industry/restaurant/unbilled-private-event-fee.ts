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
  return ["completed","held","served","finished"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledPrivateEventFeeDetector: BusinessLeakDetector = {
  id: "restaurant.unbilled-private-event-fee",
  name: "Unbilled Private Event Fee",
  description: "Detects completed private dining or restaurant events with a documented event fee that has not been billed.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Private Event","Private Event Fee","Private Event Status","Private Event Billing Status","Private Event Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Private Event Status"])) return;
      if (isAlreadyBilled(row["Private Event Billing Status"])) return;

      const amount = parseMoney(row["Private Event Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Private Event"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Private Event Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.unbilled-private-event-fee",
        leakType: "Unbilled Private Event Fee",
        title: `${customerName} has a unbilled private event fee`,
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
          status: cleanText(row["Private Event Status"]),
          billingStatus: cleanText(row["Private Event Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "private_event_fee",
          detectionReason: "private_event_completed_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "restaurant.unbilled-private-event-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
