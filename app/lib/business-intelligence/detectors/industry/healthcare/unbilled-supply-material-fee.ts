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
  return ["used","provided","consumed","completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledHealthcareSupplyMaterialFeeDetector: BusinessLeakDetector = {
  id: "healthcare.unbilled-supply-material-fee",
  name: "Unbilled Supply / Material Fee",
  description: "Detects used billable healthcare supplies or materials with a documented charge that has not been billed.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Supply Or Material","Supply Material Amount","Supply Material Status","Supply Material Billing Status","Supply Material Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Supply Material Status"])) return;
      if (isAlreadyBilled(row["Supply Material Billing Status"])) return;

      const amount = parseMoney(row["Supply Material Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Supply Or Material"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Supply Material Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.unbilled-supply-material-fee",
        leakType: "Unbilled Supply / Material Fee",
        title: `${customerName} has a unbilled supply / material fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Healthcare Billing",
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
          status: cleanText(row["Supply Material Status"]),
          billingStatus: cleanText(row["Supply Material Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "supply_material_fee",
          detectionReason: "supply_material_used_not_billed",
        },
      });
    });

    return {
      detectorId: "healthcare.unbilled-supply-material-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
