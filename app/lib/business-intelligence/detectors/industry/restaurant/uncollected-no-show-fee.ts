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
  return ["no show","missed","absent","did not arrive"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedNoShowFeeDetector: BusinessLeakDetector = {
  id: "restaurant.uncollected-no-show-fee",
  name: "Uncollected No-Show Fee",
  description: "Detects restaurant reservations marked as no-shows with a documented fee that remains uncollected.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","No-Show Reservation","No-Show Fee","Reservation Attendance Status","No-Show Fee Status","Reservation Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Reservation Attendance Status"])) return;
      if (isAlreadyBilled(row["No-Show Fee Status"])) return;

      const amount = parseMoney(row["No-Show Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["No-Show Reservation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Reservation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.uncollected-no-show-fee",
        leakType: "Uncollected No-Show Fee",
        title: `${customerName} has a uncollected no-show fee`,
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
          status: cleanText(row["Reservation Attendance Status"]),
          billingStatus: cleanText(row["No-Show Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "no_show_fee",
          detectionReason: "reservation_no_show_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "restaurant.uncollected-no-show-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
