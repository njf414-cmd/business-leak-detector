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
  return ["upgraded","activated","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledClassPackageUpgradeDetector: BusinessLeakDetector = {
  id: "health-fitness.unbilled-class-package-upgrade",
  name: "Unbilled Class Package Upgrade",
  description: "Detects activated or completed fitness class package upgrades with a documented upgrade amount that has not been billed.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Class Package Upgrade","Class Package Upgrade Amount","Class Package Upgrade Status","Class Package Upgrade Billing Status","Upgrade Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Class Package Upgrade Status"])) return;
      if (isAlreadyBilled(row["Class Package Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Class Package Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Class Package Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Upgrade Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.unbilled-class-package-upgrade",
        leakType: "Unbilled Class Package Upgrade",
        title: `${customerName} has a unbilled class package upgrade`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Fitness Billing",
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
          status: cleanText(row["Class Package Upgrade Status"]),
          billingStatus: cleanText(row["Class Package Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "class_package_upgrade",
          detectionReason: "class_package_upgraded_not_billed",
        },
      });
    });

    return {
      detectorId: "health-fitness.unbilled-class-package-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
