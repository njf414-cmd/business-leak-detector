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
  return ["completed","issued","approved","earned"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledEducationCertificationFeeDetector: BusinessLeakDetector = {
  id: "education.unbilled-certification-fee",
  name: "Unbilled Certification Fee",
  description: "Detects documented unbilled certification fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["education"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Certification","Certification Fee","Certification Status","Certification Billing Status","Certification Date"],
  },
  supports(profile) {
    return profile.industry === "education";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Certification Status"])) return;
      if (isAlreadyBilled(row["Certification Billing Status"])) return;

      const amount = parseMoney(row["Certification Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Certification"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Certification Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "education.unbilled-certification-fee",
        leakType: "Unbilled Certification Fee",
        title: `${customerName} has a unbilled certification fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Education Billing",
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
          status: cleanText(row["Certification Status"]),
          billingStatus: cleanText(row["Certification Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "education",
          revenueType: "certification_fee",
          detectionReason: "education_certification_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "education.unbilled-certification-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
