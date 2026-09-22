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
  return ["cancelled","open","available","unfilled"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["filled","rebooked","booked","paid","collected"].includes(normalizeText(value));
}

export const unfilledCancellationSlotDetector: BusinessLeakDetector = {
  id: "appointment-services.unfilled-cancellation-slot",
  name: "Unfilled Cancellation Slot",
  description: "Detects cancelled appointment slots with documented revenue value that were not refilled.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Cancellation Slot","Cancellation Slot Amount","Cancellation Slot Status","Replacement Booking Status","Cancellation Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Cancellation Slot Status"])) return;
      if (isAlreadyBilled(row["Replacement Booking Status"])) return;

      const amount = parseMoney(row["Cancellation Slot Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Cancellation Slot"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Cancellation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unfilled-cancellation-slot",
        leakType: "Unfilled Cancellation Slot",
        title: `${customerName} has a unfilled cancellation slot`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Appointment Revenue",
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
          status: cleanText(row["Cancellation Slot Status"]),
          billingStatus: cleanText(row["Replacement Booking Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "cancellation_slot_revenue",
          detectionReason: "cancelled_slot_not_refilled",
        },
      });
    });

    return {
      detectorId: "appointment-services.unfilled-cancellation-slot",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
