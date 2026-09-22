import fs from "node:fs";
import path from "node:path";

const outputPath = path.join(
  process.cwd(),
  "detector-specs",
  "deep-leak-master-expansion.json"
);

function pascalCase(value) {
  return value
    .split("-")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join("");
}

const families = [
  {
    category: "Pricing & Margin",
    detectors: [
      ["underpriced-job", "Underpriced Job", "comparison", {
        leftField: "Selling Price",
        rightField: "Required Price",
        operator: "<",
      }],
      ["discount-abuse", "Discount Abuse", "percentage", {
        numeratorField: "Discount Amount",
        denominatorField: "Pre-Discount Price",
        operator: ">",
        thresholdPercent: 20,
      }],
      ["missing-markup", "Missing Markup", "comparison", {
        leftField: "Charged Markup",
        rightField: "Required Markup",
        operator: "<",
      }],
      ["below-target-margin", "Below Target Margin", "percentage", {
        numeratorField: "Gross Profit",
        denominatorField: "Revenue",
        operator: "<",
        thresholdPercent: 25,
      }],
      ["unprofitable-customer", "Unprofitable Customer", "comparison", {
        leftField: "Customer Revenue",
        rightField: "Customer Cost",
        operator: "<",
      }],
      ["excessive-price-override", "Excessive Price Override", "percentage", {
        numeratorField: "Price Override Amount",
        denominatorField: "Standard Price",
        operator: ">",
        thresholdPercent: 15,
      }],
      ["stale-pricing", "Stale Pricing", "comparison", {
        leftField: "Current Cost",
        rightField: "Priced Cost",
        operator: ">",
      }],
      ["missed-material-markup", "Missed Material Markup", "comparison", {
        leftField: "Material Charge",
        rightField: "Required Material Charge",
        operator: "<",
      }],
      ["missed-labor-markup", "Missed Labor Markup", "comparison", {
        leftField: "Labor Charge",
        rightField: "Required Labor Charge",
        operator: "<",
      }],
      ["missed-rush-fee", "Missed Rush Fee", "missing_value", {
        targetField: "Rush Fee Charged",
      }],
      ["missed-minimum-charge", "Missed Minimum Charge", "comparison", {
        leftField: "Invoice Amount",
        rightField: "Minimum Charge",
        operator: "<",
      }],
      ["missed-travel-fee", "Missed Travel Fee", "missing_value", {
        targetField: "Travel Fee Charged",
      }],
      ["missed-after-hours-fee", "Missed After-Hours Fee", "missing_value", {
        targetField: "After Hours Fee Charged",
      }],
      ["missed-complexity-surcharge", "Missed Complexity Surcharge", "missing_value", {
        targetField: "Complexity Surcharge",
      }],
      ["contract-rate-mismatch", "Contract Rate Mismatch", "comparison", {
        leftField: "Charged Rate",
        rightField: "Contract Rate",
        operator: "!=",
      }],
    ],
  },

  {
    category: "Labor & Productivity",
    detectors: [
      ["labor-hours-overrun", "Labor Hours Overrun", "comparison", {
        leftField: "Actual Labor Hours",
        rightField: "Estimated Labor Hours",
        operator: ">",
      }],
      ["unbilled-labor-hours", "Unbilled Labor Hours", "comparison", {
        leftField: "Worked Hours",
        rightField: "Billed Hours",
        operator: ">",
      }],
      ["overtime-leakage", "Overtime Leakage", "threshold", {
        valueField: "Overtime Hours",
        operator: ">",
        threshold: 5,
      }],
      ["crew-overstaffing", "Crew Overstaffing", "comparison", {
        leftField: "Actual Crew Size",
        rightField: "Required Crew Size",
        operator: ">",
      }],
      ["idle-paid-time", "Idle Paid Time", "threshold", {
        valueField: "Idle Paid Hours",
        operator: ">",
        threshold: 2,
      }],
      ["rework-labor", "Rework Labor", "threshold", {
        valueField: "Rework Hours",
        operator: ">",
        threshold: 2,
      }],
      ["technician-underutilization", "Technician Underutilization", "percentage", {
        numeratorField: "Billable Hours",
        denominatorField: "Available Hours",
        operator: "<",
        thresholdPercent: 70,
      }],
      ["billable-utilization-gap", "Billable Utilization Gap", "percentage", {
        numeratorField: "Billable Hours",
        denominatorField: "Paid Hours",
        operator: "<",
        thresholdPercent: 65,
      }],
      ["missing-time-entry", "Missing Time Entry", "missing_value", {
        targetField: "Time Entry",
      }],
      ["time-rounded-down", "Time Rounded Down", "comparison", {
        leftField: "Billed Hours",
        rightField: "Recorded Hours",
        operator: "<",
      }],
      ["labor-rate-mismatch", "Labor Rate Mismatch", "comparison", {
        leftField: "Billed Labor Rate",
        rightField: "Required Labor Rate",
        operator: "<",
      }],
      ["nonbillable-scope-creep", "Non-Billable Scope Creep", "threshold", {
        valueField: "Unbilled Extra Hours",
        operator: ">",
        threshold: 1,
      }],
      ["excessive-admin-time", "Excessive Admin Time", "percentage", {
        numeratorField: "Admin Hours",
        denominatorField: "Paid Hours",
        operator: ">",
        thresholdPercent: 25,
      }],
      ["no-charge-service-labor", "No-Charge Service Labor", "comparison", {
        leftField: "Worked Hours",
        rightField: "Billed Hours",
        operator: ">",
      }],
      ["labor-budget-overrun", "Labor Budget Overrun", "comparison", {
        leftField: "Actual Labor Cost",
        rightField: "Budgeted Labor Cost",
        operator: ">",
      }],
    ],
  },

  {
    category: "Inventory & Materials",
    detectors: [
      ["unbilled-material-usage", "Unbilled Material Usage", "comparison", {
        leftField: "Material Used Value",
        rightField: "Material Billed Value",
        operator: ">",
      }],
      ["inventory-shrinkage", "Inventory Shrinkage", "comparison", {
        leftField: "Expected Inventory",
        rightField: "Actual Inventory",
        operator: ">",
      }],
      ["expired-inventory", "Expired Inventory", "age", {
        dateField: "Expiration Date",
        operator: ">",
        daysThreshold: 0,
      }],
      ["dead-stock", "Dead Stock", "age", {
        dateField: "Last Sale Date",
        operator: ">",
        daysThreshold: 120,
      }],
      ["inventory-overordering", "Inventory Overordering", "comparison", {
        leftField: "Inventory On Hand",
        rightField: "Target Inventory",
        operator: ">",
      }],
      ["missing-inventory-charge", "Missing Inventory Charge", "missing_value", {
        targetField: "Inventory Charge",
      }],
      ["lost-rental-equipment", "Lost Rental Equipment", "missing_value", {
        targetField: "Equipment Return Date",
      }],
      ["damaged-inventory-loss", "Damaged Inventory Loss", "threshold", {
        valueField: "Damaged Units",
        operator: ">",
        threshold: 0,
      }],
      ["stockout-lost-sale", "Stockout Lost Sale", "threshold", {
        valueField: "Lost Sales Quantity",
        operator: ">",
        threshold: 0,
      }],
      ["low-margin-product", "Low Margin Product", "percentage", {
        numeratorField: "Gross Profit",
        denominatorField: "Product Revenue",
        operator: "<",
        thresholdPercent: 20,
      }],
      ["missing-restocking-fee", "Missing Restocking Fee", "missing_value", {
        targetField: "Restocking Fee",
      }],
      ["supplier-increase-not-passed-through", "Supplier Increase Not Passed Through", "comparison", {
        leftField: "Current Supplier Cost",
        rightField: "Pricing Cost Basis",
        operator: ">",
      }],
      ["material-waste", "Material Waste Above Target", "percentage", {
        numeratorField: "Wasted Material",
        denominatorField: "Material Used",
        operator: ">",
        thresholdPercent: 10,
      }],
      ["duplicate-purchasing", "Duplicate Purchasing", "aggregate", {
        groupField: "Purchase Item",
        aggregateField: "Purchase Count",
        operator: ">",
        threshold: 1,
      }],
      ["unused-project-materials", "Unused Project Materials", "threshold", {
        valueField: "Unused Material Quantity",
        operator: ">",
        threshold: 0,
      }],
    ],
  },

  {
    category: "Retention & Churn",
    detectors: [
      ["customer-not-rebooked", "Customer Not Rebooked", "age", {
        dateField: "Last Service Date",
        operator: ">",
        daysThreshold: 90,
      }],
      ["lapsed-customer", "Lapsed Customer", "age", {
        dateField: "Last Purchase Date",
        operator: ">",
        daysThreshold: 180,
      }],
      ["membership-churn-risk", "Membership Churn Risk", "trend", {
        currentField: "Current Usage",
        baselineField: "Historical Usage",
        operator: "<",
        thresholdPercent: -30,
      }],
      ["cancelled-subscription-not-recovered", "Cancelled Subscription Not Recovered", "missing_value", {
        targetField: "Recovery Outcome",
      }],
      ["dormant-high-value-customer", "Dormant High-Value Customer", "age", {
        dateField: "Last Purchase Date",
        operator: ">",
        daysThreshold: 120,
      }],
      ["lost-repeat-purchase", "Lost Repeat Purchase", "date_gap", {
        startDateField: "Previous Purchase Date",
        endDateField: "Expected Repurchase Date",
        operator: ">",
        daysThreshold: 30,
      }],
      ["missed-renewal", "Missed Renewal", "age", {
        dateField: "Renewal Due Date",
        operator: ">",
        daysThreshold: 0,
      }],
      ["missed-post-service-followup", "Missed Post-Service Follow-Up", "missing_value", {
        targetField: "Follow Up Date",
      }],
      ["poor-review-not-recovered", "Poor Review Not Recovered", "missing_value", {
        targetField: "Review Recovery Outcome",
      }],
      ["unresolved-customer-complaint", "Unresolved Customer Complaint", "age", {
        dateField: "Complaint Date",
        operator: ">",
        daysThreshold: 7,
      }],
      ["customer-downgrade-leakage", "Customer Downgrade Leakage", "comparison", {
        leftField: "Current Plan Value",
        rightField: "Previous Plan Value",
        operator: "<",
      }],
      ["purchase-frequency-decline", "Purchase Frequency Decline", "trend", {
        currentField: "Current Purchase Frequency",
        baselineField: "Historical Purchase Frequency",
        operator: "<",
        thresholdPercent: -25,
      }],
      ["customer-spend-decline", "Customer Spend Decline", "trend", {
        currentField: "Current Spend",
        baselineField: "Historical Spend",
        operator: "<",
        thresholdPercent: -20,
      }],
      ["vip-customer-inactivity", "VIP Customer Inactivity", "age", {
        dateField: "Last Activity Date",
        operator: ">",
        daysThreshold: 60,
      }],
      ["failed-payment-churn", "Failed Payment Churn", "threshold", {
        valueField: "Failed Payment Count",
        operator: ">",
        threshold: 1,
      }],
    ],
  },

  {
    category: "Sales & Expansion",
    detectors: [
      ["recommended-service-not-sold", "Recommended Service Not Sold", "missing_value", {
        targetField: "Recommended Service Sale",
      }],
      ["upsell-not-offered", "Upsell Not Offered", "missing_value", {
        targetField: "Upsell Offer",
      }],
      ["cross-sell-not-offered", "Cross-Sell Not Offered", "missing_value", {
        targetField: "Cross Sell Offer",
      }],
      ["quote-partially-accepted", "Quote Partially Accepted", "comparison", {
        leftField: "Accepted Quote Amount",
        rightField: "Quoted Amount",
        operator: "<",
      }],
      ["missed-addon-opportunity", "Missed Add-On Opportunity", "missing_value", {
        targetField: "Add On Sold",
      }],
      ["missed-warranty-opportunity", "Missed Warranty Opportunity", "missing_value", {
        targetField: "Warranty Sold",
      }],
      ["missed-maintenance-plan", "Missed Maintenance Plan Opportunity", "missing_value", {
        targetField: "Maintenance Plan Sold",
      }],
      ["missed-premium-package", "Missed Premium Package Opportunity", "missing_value", {
        targetField: "Premium Package Offered",
      }],
      ["missed-financing-opportunity", "Missed Financing Opportunity", "missing_value", {
        targetField: "Financing Offered",
      }],
      ["missed-bundle-opportunity", "Missed Bundle Opportunity", "missing_value", {
        targetField: "Bundle Offered",
      }],
      ["abandoned-high-value-quote", "Abandoned High-Value Quote", "age", {
        dateField: "Quote Date",
        operator: ">",
        daysThreshold: 14,
      }],
      ["lead-without-second-offer", "Lead Without Second Offer", "missing_value", {
        targetField: "Second Offer Date",
      }],
      ["customer-upgrade-eligible", "Customer Upgrade Eligible", "comparison", {
        leftField: "Current Plan Value",
        rightField: "Eligible Plan Value",
        operator: "<",
      }],
      ["missed-recurring-plan", "Missed Recurring Plan Opportunity", "missing_value", {
        targetField: "Recurring Plan Offered",
      }],
      ["low-product-attachment-rate", "Low Product Attachment Rate", "percentage", {
        numeratorField: "Attached Product Sales",
        denominatorField: "Eligible Transactions",
        operator: "<",
        thresholdPercent: 20,
      }],
    ],
  },

  {
    category: "Capacity & Scheduling",
    detectors: [
      ["open-appointment-capacity", "Open Appointment Capacity", "percentage", {
        numeratorField: "Booked Slots",
        denominatorField: "Available Slots",
        operator: "<",
        thresholdPercent: 75,
      }],
      ["technician-idle-capacity", "Technician Idle Capacity", "threshold", {
        valueField: "Idle Hours",
        operator: ">",
        threshold: 2,
      }],
      ["underbooked-day", "Underbooked Day", "percentage", {
        numeratorField: "Booked Hours",
        denominatorField: "Available Hours",
        operator: "<",
        thresholdPercent: 70,
      }],
      ["cancellation-slot-not-refilled", "Cancellation Slot Not Refilled", "missing_value", {
        targetField: "Replacement Booking",
      }],
      ["no-show-slot-not-refilled", "No-Show Slot Not Refilled", "missing_value", {
        targetField: "Replacement Booking",
      }],
      ["unused-equipment-capacity", "Unused Equipment Capacity", "percentage", {
        numeratorField: "Equipment Used Hours",
        denominatorField: "Equipment Available Hours",
        operator: "<",
        thresholdPercent: 60,
      }],
      ["unused-room-capacity", "Unused Room Capacity", "percentage", {
        numeratorField: "Occupied Capacity",
        denominatorField: "Available Capacity",
        operator: "<",
        thresholdPercent: 70,
      }],
      ["low-occupancy", "Low Occupancy", "percentage", {
        numeratorField: "Occupied Units",
        denominatorField: "Available Units",
        operator: "<",
        thresholdPercent: 70,
      }],
      ["overlong-appointment", "Overlong Appointment", "comparison", {
        leftField: "Actual Duration",
        rightField: "Scheduled Duration",
        operator: ">",
      }],
      ["excessive-buffer-time", "Excessive Buffer Time", "threshold", {
        valueField: "Buffer Minutes",
        operator: ">",
        threshold: 30,
      }],
      ["scheduling-gap", "Scheduling Gap", "date_gap", {
        startDateField: "Previous Booking End",
        endDateField: "Next Booking Start",
        operator: ">",
        daysThreshold: 1,
      }],
      ["high-demand-slot-underpriced", "High-Demand Slot Underpriced", "comparison", {
        leftField: "Slot Price",
        rightField: "Target Peak Price",
        operator: "<",
      }],
      ["unused-offpeak-capacity", "Unused Off-Peak Capacity", "percentage", {
        numeratorField: "Off Peak Booked Capacity",
        denominatorField: "Off Peak Available Capacity",
        operator: "<",
        thresholdPercent: 50,
      }],
      ["route-inefficiency", "Crew Route Inefficiency", "threshold", {
        valueField: "Unproductive Travel Minutes",
        operator: ">",
        threshold: 60,
      }],
      ["missed-same-day-booking", "Missed Same-Day Booking Opportunity", "missing_value", {
        targetField: "Same Day Booking",
      }],
    ],
  },

  {
    category: "Collections & Cash Flow",
    detectors: [
      ["aging-receivable", "Aging Receivable", "age", {
        dateField: "Invoice Date",
        operator: ">",
        daysThreshold: 30,
      }],
      ["partial-payment-balance", "Partial Payment Balance", "comparison", {
        leftField: "Invoice Amount",
        rightField: "Amount Paid",
        operator: ">",
      }],
      ["failed-autopay", "Failed Autopay", "threshold", {
        valueField: "Failed Autopay Count",
        operator: ">",
        threshold: 0,
      }],
      ["unpaid-deposit", "Unpaid Deposit", "comparison", {
        leftField: "Required Deposit",
        rightField: "Deposit Paid",
        operator: ">",
      }],
      ["unpaid-final-balance", "Unpaid Final Balance", "comparison", {
        leftField: "Final Amount Due",
        rightField: "Final Amount Paid",
        operator: ">",
      }],
      ["stale-invoice", "Stale Invoice", "age", {
        dateField: "Invoice Date",
        operator: ">",
        daysThreshold: 45,
      }],
      ["invoice-never-sent", "Invoice Never Sent", "missing_value", {
        targetField: "Invoice Sent Date",
      }],
      ["payment-plan-delinquency", "Payment Plan Delinquency", "age", {
        dateField: "Payment Due Date",
        operator: ">",
        daysThreshold: 7,
      }],
      ["returned-payment", "Returned Payment", "threshold", {
        valueField: "Returned Payment Count",
        operator: ">",
        threshold: 0,
      }],
      ["uncollected-fee", "Uncollected Fee", "comparison", {
        leftField: "Fee Due",
        rightField: "Fee Collected",
        operator: ">",
      }],
      ["severely-aged-receivable", "Severely Aged Receivable", "age", {
        dateField: "Invoice Date",
        operator: ">",
        daysThreshold: 90,
      }],
      ["unapplied-customer-credit", "Unapplied Customer Credit", "threshold", {
        valueField: "Unapplied Credit",
        operator: ">",
        threshold: 0,
      }],
      ["unapplied-payment", "Unapplied Payment", "threshold", {
        valueField: "Unapplied Payment Amount",
        operator: ">",
        threshold: 0,
      }],
      ["missing-payment-method", "Missing Payment Method", "missing_value", {
        targetField: "Payment Method",
      }],
      ["unresolved-invoice-dispute", "Unresolved Invoice Dispute", "age", {
        dateField: "Dispute Opened Date",
        operator: ">",
        daysThreshold: 14,
      }],
    ],
  },

  {
    category: "Contract & Revenue Assurance",
    detectors: [
      ["contracted-fee-not-billed", "Contracted Fee Not Billed", "comparison", {
        leftField: "Contracted Fee",
        rightField: "Billed Fee",
        operator: ">",
      }],
      ["annual-escalation-not-applied", "Annual Escalation Not Applied", "comparison", {
        leftField: "Required Escalated Rate",
        rightField: "Current Charged Rate",
        operator: ">",
      }],
      ["minimum-commitment-missed", "Minimum Commitment Missed", "comparison", {
        leftField: "Minimum Commitment",
        rightField: "Actual Billed Amount",
        operator: ">",
      }],
      ["usage-overage-not-billed", "Usage Overage Not Billed", "comparison", {
        leftField: "Actual Usage",
        rightField: "Billed Usage",
        operator: ">",
      }],
      ["excessive-sla-credit", "Excessive SLA Credit", "comparison", {
        leftField: "SLA Credit Issued",
        rightField: "Allowed SLA Credit",
        operator: ">",
      }],
      ["contract-renewal-not-processed", "Contract Renewal Not Processed", "age", {
        dateField: "Contract Renewal Date",
        operator: ">",
        daysThreshold: 0,
      }],
      ["auto-renewal-not-billed", "Auto-Renewal Not Billed", "missing_value", {
        targetField: "Renewal Invoice",
      }],
      ["scope-creep", "Scope Creep", "comparison", {
        leftField: "Actual Scope Units",
        rightField: "Contracted Scope Units",
        operator: ">",
      }],
      ["missing-change-order", "Missing Change Order", "missing_value", {
        targetField: "Change Order Number",
      }],
      ["missed-milestone-billing", "Missed Milestone Billing", "missing_value", {
        targetField: "Milestone Invoice",
      }],
      ["retainer-overage-not-billed", "Retainer Overage Not Billed", "comparison", {
        leftField: "Actual Retainer Usage",
        rightField: "Included Retainer Usage",
        operator: ">",
      }],
      ["prepaid-credit-overconsumption", "Prepaid Credit Overconsumption", "comparison", {
        leftField: "Credits Used",
        rightField: "Credits Purchased",
        operator: ">",
      }],
      ["entitlement-overuse", "Entitlement Overuse", "comparison", {
        leftField: "Actual Entitlement Usage",
        rightField: "Allowed Entitlement Usage",
        operator: ">",
      }],
      ["expired-contract-discount", "Expired Contract Discount", "age", {
        dateField: "Discount Expiration Date",
        operator: ">",
        daysThreshold: 0,
      }],
      ["rate-card-mismatch", "Rate Card Mismatch", "comparison", {
        leftField: "Charged Rate",
        rightField: "Rate Card Rate",
        operator: "!=",
      }],
    ],
  },
];

const specs = [];

let number = 196;

for (const family of families) {
  if (family.detectors.length !== 15) {
    throw new Error(
      `${family.category} must contain exactly 15 detectors.`
    );
  }

  for (const [
    slug,
    name,
    ruleType,
    ruleConfig,
  ] of family.detectors) {
    specs.push({
      number,

      id:
        `deep.${slug}`,

      exportName:
        `deep${pascalCase(slug)}Detector`,

      fileName:
        `deep-${slug}.ts`,

      name,

      description:
        `Detects ${name.toLowerCase()} using documented business data and a ${ruleType} rule.`,

      industry:
        "other",

      scope:
        "universal",

      ruleType,

      itemField:
        "Record",

      amountField:
        "Revenue Impact",

      leakType:
        name,

      category:
        family.category,

      revenueType:
        slug.replaceAll("-", "_"),

      detectionReason:
        `deep_${slug.replaceAll("-", "_")}`,

      recommendedActionVerb:
        "review",

      ...ruleConfig,
    });

    number += 1;
  }
}

if (specs.length !== 120) {
  throw new Error(
    `Expected 120 detectors, got ${specs.length}.`
  );
}

if (
  specs[0].number !== 196 ||
  specs[specs.length - 1].number !== 315
) {
  throw new Error(
    "Detector numbering is not #196–#315."
  );
}

fs.mkdirSync(
  path.dirname(outputPath),
  {
    recursive: true,
  }
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    specs,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  `✅ Created ${specs.length} deep detector specs`
);

console.log(
  `✅ #${specs[0].number}–#${specs[specs.length - 1].number}`
);

for (const family of families) {
  console.log(
    `✅ ${family.category}: ${family.detectors.length}`
  );
}

console.log(
  `✅ ${outputPath}`
);
