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
  return ["activated","upgraded","active","provided"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSoftwareSupportUpgradeDetector: BusinessLeakDetector = {
  id: "software.unbilled-support-upgrade",
  name: "Unbilled Support Upgrade",
  description: "Detects documented unbilled support upgrade opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Support Upgrade","Support Upgrade Amount","Support Status","Support Billing Status","Upgrade Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Support Status"])) return;
      if (isAlreadyBilled(row["Support Billing Status"])) return;

      const amount = parseMoney(row["Support Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Support Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Upgrade Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.unbilled-support-upgrade",
        leakType: "Unbilled Support Upgrade",
        title: `${customerName} has a unbilled support upgrade`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Software Billing",
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
          status: cleanText(row["Support Status"]),
          billingStatus: cleanText(row["Support Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "support_upgrade",
          detectionReason: "software_support_upgrade_not_billed",
        },
      });
    });

    return {
      detectorId: "software.unbilled-support-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
