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
  return ["completed","complete","qualified","follow up needed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["converted","booked","scheduled","paid","collected"].includes(normalizeText(value));
}

export const unconvertedConsultationDetector: BusinessLeakDetector = {
  id: "appointment-services.unconverted-consultation",
  name: "Unconverted Consultation",
  description: "Detects completed consultations with documented potential revenue that did not convert to a paid service.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Consultation","Consultation Opportunity Amount","Consultation Status","Consultation Conversion Status","Consultation Date"],
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
      if (isAlreadyBilled(row["Consultation Conversion Status"])) return;

      const amount = parseMoney(row["Consultation Opportunity Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Consultation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Consultation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unconverted-consultation",
        leakType: "Unconverted Consultation",
        title: `${customerName} has a unconverted consultation`,
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
          status: cleanText(row["Consultation Status"]),
          billingStatus: cleanText(row["Consultation Conversion Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "consultation_conversion",
          detectionReason: "completed_consultation_not_converted",
        },
      });
    });

    return {
      detectorId: "appointment-services.unconverted-consultation",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
