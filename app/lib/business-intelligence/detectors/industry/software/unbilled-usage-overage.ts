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
  return ["exceeded","used","confirmed","billable"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSoftwareUsageOverageDetector: BusinessLeakDetector = {
  id: "software.unbilled-usage-overage",
  name: "Unbilled Usage Overage",
  description: "Detects documented unbilled usage overage opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Usage Overage","Usage Overage Amount","Usage Status","Overage Billing Status","Usage Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Usage Status"])) return;
      if (isAlreadyBilled(row["Overage Billing Status"])) return;

      const amount = parseMoney(row["Usage Overage Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Usage Overage"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Usage Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.unbilled-usage-overage",
        leakType: "Unbilled Usage Overage",
        title: `${customerName} has a unbilled usage overage`,
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
          status: cleanText(row["Usage Status"]),
          billingStatus: cleanText(row["Overage Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "usage_overage",
          detectionReason: "software_usage_overage_not_billed",
        },
      });
    });

    return {
      detectorId: "software.unbilled-usage-overage",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
