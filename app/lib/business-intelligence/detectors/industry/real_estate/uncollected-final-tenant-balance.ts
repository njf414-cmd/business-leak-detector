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
  return ["moved out","completed","closed","finalized"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedFinalTenantBalanceDetector: BusinessLeakDetector = {
  id: "real-estate.uncollected-final-tenant-balance",
  name: "Uncollected Final Tenant Balance",
  description: "Detects documented final tenant balances remaining after move-out or lease completion.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Final Tenant Account","Final Tenant Balance","Move-Out Status","Final Balance Status","Move-Out Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Move-Out Status"])) return;
      if (isAlreadyBilled(row["Final Balance Status"])) return;

      const amount = parseMoney(row["Final Tenant Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Final Tenant Account"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Move-Out Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.uncollected-final-tenant-balance",
        leakType: "Uncollected Final Tenant Balance",
        title: `${customerName} has a uncollected final tenant balance`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Real Estate Billing",
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
          status: cleanText(row["Move-Out Status"]),
          billingStatus: cleanText(row["Final Balance Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "final_tenant_balance",
          detectionReason: "final_tenant_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "real-estate.uncollected-final-tenant-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
