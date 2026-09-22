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
  return ["cancelled","canceled","closed","terminated"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedSoftwareFinalAccountBalanceDetector: BusinessLeakDetector = {
  id: "software.uncollected-final-account-balance",
  name: "Uncollected Final Account Balance",
  description: "Detects documented uncollected final account balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Customer Account","Final Account Balance","Account Status","Final Account Payment Status","Account End Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Account Status"])) return;
      if (isAlreadyBilled(row["Final Account Payment Status"])) return;

      const amount = parseMoney(row["Final Account Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Customer Account"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Account End Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.uncollected-final-account-balance",
        leakType: "Uncollected Final Account Balance",
        title: `${customerName} has a uncollected final account balance`,
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
          status: cleanText(row["Account Status"]),
          billingStatus: cleanText(row["Final Account Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "final_account_balance",
          detectionReason: "software_final_account_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "software.uncollected-final-account-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
