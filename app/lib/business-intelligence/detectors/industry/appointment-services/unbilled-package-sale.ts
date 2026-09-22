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
  return ["sold","activated","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledPackageSaleDetector: BusinessLeakDetector = {
  id: "appointment-services.unbilled-package-sale",
  name: "Unbilled Package Sale",
  description: "Detects service packages sold or activated without the documented package amount being billed.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Service Package","Package Amount","Package Status","Package Billing Status","Package Sale Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Package Status"])) return;
      if (isAlreadyBilled(row["Package Billing Status"])) return;

      const amount = parseMoney(row["Package Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Service Package"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Package Sale Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unbilled-package-sale",
        leakType: "Unbilled Package Sale",
        title: `${customerName} has a unbilled package sale`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Appointment Billing",
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
          status: cleanText(row["Package Status"]),
          billingStatus: cleanText(row["Package Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "service_package",
          detectionReason: "package_sold_not_billed",
        },
      });
    });

    return {
      detectorId: "appointment-services.unbilled-package-sale",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
