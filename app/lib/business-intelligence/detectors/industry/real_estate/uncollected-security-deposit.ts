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
  return ["approved","signed","active","move in scheduled"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedSecurityDepositDetector: BusinessLeakDetector = {
  id: "real-estate.uncollected-security-deposit",
  name: "Uncollected Security Deposit",
  description: "Detects approved leases or move-ins with documented security deposits that have not been collected.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Lease","Security Deposit Amount","Lease Status","Security Deposit Status","Lease Start Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Lease Status"])) return;
      if (isAlreadyBilled(row["Security Deposit Status"])) return;

      const amount = parseMoney(row["Security Deposit Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Lease"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Lease Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.uncollected-security-deposit",
        leakType: "Uncollected Security Deposit",
        title: `${customerName} has a uncollected security deposit`,
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
          status: cleanText(row["Lease Status"]),
          billingStatus: cleanText(row["Security Deposit Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "security_deposit",
          detectionReason: "security_deposit_due_not_collected",
        },
      });
    });

    return {
      detectorId: "real-estate.uncollected-security-deposit",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
