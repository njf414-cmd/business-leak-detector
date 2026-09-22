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
  return ["completed","complete","performed","billable"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","invoice sent","paid","collected"].includes(normalizeText(value));
}

export const unbilledConsultationFeeDetector: BusinessLeakDetector = {
  id: "appointment-services.unbilled-consultation-fee",
  name: "Unbilled Consultation Fee",
  description: "Detects completed billable consultations whose documented consultation fee was not billed.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Consultation","Consultation Fee","Consultation Status","Consultation Billing Status","Consultation Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Consultation Status"])) return;
      if (isAlreadyBilled(row["Consultation Billing Status"])) return;

      const amount = parseMoney(row["Consultation Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Consultation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Consultation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unbilled-consultation-fee",
        leakType: "Unbilled Consultation Fee",
        title: `${customerName} has a unbilled consultation fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Appointment Billing",
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
          status: cleanText(row["Consultation Status"]),
          billingStatus: cleanText(row["Consultation Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "consultation_fee",
          detectionReason: "completed_consultation_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "appointment-services.unbilled-consultation-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
