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
  return ["provided","served","completed","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","included","paid","collected"].includes(normalizeText(value));
}

export const unbilledMenuUpgradeDetector: BusinessLeakDetector = {
  id: "restaurant.unbilled-menu-upgrade",
  name: "Unbilled Menu Upgrade",
  description: "Detects premium menu upgrades or event package upgrades with a documented amount that has not been billed.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Menu Upgrade","Menu Upgrade Amount","Menu Upgrade Status","Menu Upgrade Billing Status","Service Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Menu Upgrade Status"])) return;
      if (isAlreadyBilled(row["Menu Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Menu Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Menu Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Service Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.unbilled-menu-upgrade",
        leakType: "Unbilled Menu Upgrade",
        title: `${customerName} has a unbilled menu upgrade`,
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
          status: cleanText(row["Menu Upgrade Status"]),
          billingStatus: cleanText(row["Menu Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "menu_upgrade",
          detectionReason: "menu_upgrade_provided_not_billed",
        },
      });
    });

    return {
      detectorId: "restaurant.unbilled-menu-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
