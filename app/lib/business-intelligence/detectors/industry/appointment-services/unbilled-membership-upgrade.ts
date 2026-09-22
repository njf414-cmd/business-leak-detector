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
  return ["upgraded","approved","activated","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledMembershipUpgradeDetector: BusinessLeakDetector = {
  id: "appointment-services.unbilled-membership-upgrade",
  name: "Unbilled Membership Upgrade",
  description: "Detects completed or activated membership upgrades that have not been billed.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Membership Upgrade","Membership Upgrade Amount","Membership Upgrade Status","Membership Upgrade Billing Status","Membership Upgrade Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Membership Upgrade Status"])) return;
      if (isAlreadyBilled(row["Membership Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Membership Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Membership Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Membership Upgrade Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unbilled-membership-upgrade",
        leakType: "Unbilled Membership Upgrade",
        title: `${customerName} has a unbilled membership upgrade`,
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
          status: cleanText(row["Membership Upgrade Status"]),
          billingStatus: cleanText(row["Membership Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "membership_upgrade",
          detectionReason: "membership_upgrade_not_billed",
        },
      });
    });

    return {
      detectorId: "appointment-services.unbilled-membership-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
