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
  return ["renewed","approved","active","renewal due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","settled"].includes(normalizeText(value));
}

export const uncollectedBeautyPackageRenewalDetector: BusinessLeakDetector = {
  id: "beauty.uncollected-package-renewal",
  name: "Uncollected Package Renewal",
  description: "Detects documented uncollected package renewal opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["beauty"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Package Renewal","Package Renewal Amount","Package Renewal Status","Package Renewal Payment Status","Renewal Date"],
  },
  supports(profile) {
    return profile.industry === "beauty";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Package Renewal Status"])) return;
      if (isAlreadyBilled(row["Package Renewal Payment Status"])) return;

      const amount = parseMoney(row["Package Renewal Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Package Renewal"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Renewal Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "beauty.uncollected-package-renewal",
        leakType: "Uncollected Package Renewal",
        title: `${customerName} has a uncollected package renewal`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Beauty Billing",
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
          status: cleanText(row["Package Renewal Status"]),
          billingStatus: cleanText(row["Package Renewal Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "beauty",
          revenueType: "package_renewal",
          detectionReason: "beauty_package_renewal_not_collected",
        },
      });
    });

    return {
      detectorId: "beauty.uncollected-package-renewal",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
