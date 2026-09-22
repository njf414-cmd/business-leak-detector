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
  return ["activated","upgraded","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledRetailWarrantyUpgradeDetector: BusinessLeakDetector = {
  id: "retail.unbilled-warranty-upgrade",
  name: "Unbilled Warranty Upgrade",
  description: "Detects documented unbilled warranty upgrade opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["retail"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Warranty Upgrade","Warranty Upgrade Amount","Warranty Status","Warranty Billing Status","Warranty Date"],
  },
  supports(profile) {
    return profile.industry === "retail";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Warranty Status"])) return;
      if (isAlreadyBilled(row["Warranty Billing Status"])) return;

      const amount = parseMoney(row["Warranty Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Warranty Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Warranty Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "retail.unbilled-warranty-upgrade",
        leakType: "Unbilled Warranty Upgrade",
        title: `${customerName} has a unbilled warranty upgrade`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Retail Billing",
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
          status: cleanText(row["Warranty Status"]),
          billingStatus: cleanText(row["Warranty Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "retail",
          revenueType: "warranty_upgrade",
          detectionReason: "retail_warranty_upgrade_not_billed",
        },
      });
    });

    return {
      detectorId: "retail.unbilled-warranty-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
