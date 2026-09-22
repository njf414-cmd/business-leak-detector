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
  return ["terminated","early termination","lease broken","fee due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedLeaseBreakFeeDetector: BusinessLeakDetector = {
  id: "real-estate.uncollected-lease-break-fee",
  name: "Uncollected Lease-Break Fee",
  description: "Detects documented early lease termination fees that became due but have not been collected.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Lease Termination","Lease Break Fee Amount","Lease Termination Status","Lease Break Fee Status","Lease Termination Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Lease Termination Status"])) return;
      if (isAlreadyBilled(row["Lease Break Fee Status"])) return;

      const amount = parseMoney(row["Lease Break Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Lease Termination"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Lease Termination Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.uncollected-lease-break-fee",
        leakType: "Uncollected Lease-Break Fee",
        title: `${customerName} has a uncollected lease-break fee`,
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
          status: cleanText(row["Lease Termination Status"]),
          billingStatus: cleanText(row["Lease Break Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "lease_break_fee",
          detectionReason: "lease_break_fee_due_not_collected",
        },
      });
    });

    return {
      detectorId: "real-estate.uncollected-lease-break-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
