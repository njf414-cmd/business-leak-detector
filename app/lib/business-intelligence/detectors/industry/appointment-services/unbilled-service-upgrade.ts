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
  return ["completed","performed","provided","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","invoice sent","paid","collected"].includes(normalizeText(value));
}

export const unbilledServiceUpgradeDetector: BusinessLeakDetector = {
  id: "appointment-services.unbilled-service-upgrade",
  name: "Unbilled Service Upgrade",
  description: "Detects completed service upgrades that were delivered but not billed.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Service Upgrade","Service Upgrade Amount","Service Upgrade Status","Service Upgrade Billing Status","Appointment Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Service Upgrade Status"])) return;
      if (isAlreadyBilled(row["Service Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Service Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Service Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Appointment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unbilled-service-upgrade",
        leakType: "Unbilled Service Upgrade",
        title: `${customerName} has a unbilled service upgrade`,
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
          status: cleanText(row["Service Upgrade Status"]),
          billingStatus: cleanText(row["Service Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "service_upgrade",
          detectionReason: "completed_upgrade_not_billed",
        },
      });
    });

    return {
      detectorId: "appointment-services.unbilled-service-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
