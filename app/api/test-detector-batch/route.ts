import {
  NextRequest,
  NextResponse,
} from "next/server";

import fs from "node:fs";
import path from "node:path";

import {
  runBusinessDetectors,
} from "../../lib/business-intelligence/detector-runner";

import {
  getAllDetectors,
  getSupportedDetectors,
} from "../../lib/business-intelligence/detector-registry";

import {
  getDetectorCatalog,
  registerDetectorCatalog,
} from "../../lib/business-intelligence/detector-catalog";

import type {
  BusinessDataRow,
} from "../../lib/business-intelligence/detector-types";

import type {
  BusinessIndustry,
  BusinessIntelligenceProfile,
  BusinessModel,
} from "../../lib/business-intelligence/types";

/* =========================================
   TYPES
========================================= */

type DetectorScope =
  | "industry"
  | "universal";

type RuleType =
  | "status_amount"
  | "comparison"
  | "ratio"
  | "threshold"
  | "age"
  | "missing_value"
  | "date_gap"
  | "percentage"
  | "trend"
  | "aggregate";

type DetectorBatchSpec = {
  number: number;

  id: string;

  exportName: string;

  fileName: string;

  name: string;

  description: string;

  industry: BusinessIndustry;

  scope?: DetectorScope;

  ruleType?: RuleType;

  customerField?: string;

  projectField?: string;

  itemField: string;

  amountField: string;

  statusField?: string;

  billingStatusField?: string;

  dateField?: string;

  positiveStatuses?: string[];

  billedStatuses?: string[];

  leftField?: string;

  rightField?: string;

  operator?: string;

  numeratorField?: string;

  denominatorField?: string;

  threshold?: number;

  valueField?: string;

  daysThreshold?: number;

  targetField?: string;

  startDateField?: string;

  endDateField?: string;

  thresholdPercent?: number;

  currentField?: string;

  baselineField?: string;

  groupField?: string;

  aggregateField?: string;

  leakType: string;

  category: string;

  revenueType: string;

  detectionReason: string;

  recommendedActionVerb?: string;

  recoveryRate?: number;

  severityMedium?: number;

  severityHigh?: number;
};

type TestPlan = {
  rows: BusinessDataRow[];

  positiveOneCustomer: string;

  positiveTwoCustomer: string;

  negativeOneCustomer: string;

  negativeTwoCustomer: string;

  missingDataCustomer: string;

  expectedLossOne: number;

  expectedLossTwo: number;

  positiveOneLabel: string;

  positiveTwoLabel: string;

  negativeOneLabel: string;

  negativeTwoLabel: string;

  missingDataLabel: string;
};

/* =========================================
   CONSTANTS
========================================= */

const TEST_NOW =
  new Date(
    "2026-09-21T12:00:00.000Z"
  );

/* =========================================
   PROFILE
========================================= */

function getBusinessModel(
  industry: BusinessIndustry
): BusinessModel {
  switch (industry) {
    case "construction":
      return "construction";

    case "automotive":
      return "automotive";

    case "restaurant":
    case "hospitality":
      return "hospitality";

    case "retail":
      return "retail";

    case "ecommerce":
      return "ecommerce";

    case "professional_services":
    case "agency":
      return "professional_service";

    case "real_estate":
      return "real_estate";

    case "healthcare":
    case "health_fitness":
      return "healthcare";

    case "software":
      return "subscription";

    default:
      return "service";
  }
}

function createProfile(
  industry: BusinessIndustry
): BusinessIntelligenceProfile {
  return {
    businessId:
      `batch-test-${industry}`,

    businessName:
      `Batch Test ${industry}`,

    industry,

    businessModel:
      getBusinessModel(
        industry
      ),

    revenueModels: [
      "one_time",
      "recurring",
      "project_based",
      "transactional",
      "mixed",
    ],

    capabilities: {
      usesLeads: true,
      usesQuotes: true,
      usesInvoices: true,
      usesAppointments: true,
      usesJobs: true,
      usesOrders: true,
      usesSubscriptions: true,
      usesPayments: true,
      usesCustomerRelationships: true,
      usesSalesPipeline: true,
    },

    description:
      `Runtime detector batch test for ${industry}.`,

    metadata: {},
  };
}

/* =========================================
   LOAD BATCH
========================================= */

function loadBatch(
  fileName: string
): DetectorBatchSpec[] {
  const safeFileName =
    path.basename(
      fileName
    );

  if (
    !safeFileName.endsWith(
      ".json"
    )
  ) {
    throw new Error(
      "Batch file must be a JSON file."
    );
  }

  const specPath =
    path.join(
      process.cwd(),
      "detector-specs",
      safeFileName
    );

  if (
    !fs.existsSync(
      specPath
    )
  ) {
    throw new Error(
      `Batch file not found: detector-specs/${safeFileName}`
    );
  }

  const raw =
    fs.readFileSync(
      specPath,
      "utf8"
    );

  const parsed =
    JSON.parse(
      raw
    ) as DetectorBatchSpec[];

  if (
    !Array.isArray(
      parsed
    ) ||
    parsed.length ===
      0
  ) {
    throw new Error(
      "Batch JSON is empty."
    );
  }

  return parsed.sort(
    (a, b) =>
      a.number -
      b.number
  );
}

/* =========================================
   RULE HELPERS
========================================= */

function getRuleType(
  spec: DetectorBatchSpec
): RuleType {
  return (
    spec.ruleType ??
    "status_amount"
  );
}

function compareNumbers(
  left: number,
  right: number,
  operator: string
): boolean {
  switch (operator) {
    case ">":
      return left > right;

    case ">=":
      return left >= right;

    case "<":
      return left < right;

    case "<=":
      return left <= right;

    case "=":
    case "==":
    case "===":
      return left === right;

    case "!=":
    case "!==":
      return left !== right;

    default:
      throw new Error(
        `Unsupported test operator: ${operator}`
      );
  }
}

function passingValue(
  comparisonValue: number,
  operator: string
): number {
  switch (operator) {
    case ">":
      return comparisonValue + 10;

    case ">=":
      return comparisonValue + 10;

    case "<":
      return comparisonValue - 10;

    case "<=":
      return comparisonValue - 10;

    case "=":
    case "==":
    case "===":
      return comparisonValue;

    case "!=":
    case "!==":
      return comparisonValue + 10;

    default:
      throw new Error(
        `Unsupported test operator: ${operator}`
      );
  }
}

function failingValue(
  comparisonValue: number,
  operator: string
): number {
  switch (operator) {
    case ">":
    case ">=":
      return comparisonValue - 10;

    case "<":
    case "<=":
      return comparisonValue + 10;

    case "=":
    case "==":
    case "===":
      return comparisonValue + 10;

    case "!=":
    case "!==":
      return comparisonValue;

    default:
      throw new Error(
        `Unsupported test operator: ${operator}`
      );
  }
}

function isoDateDaysAgo(
  days: number
): string {
  const milliseconds =
    TEST_NOW.getTime() -
    days *
      86400000;

  return new Date(
    milliseconds
  )
    .toISOString()
    .slice(
      0,
      10
    );
}

function isoDatePlusDays(
  base:
    string,
  days:
    number
): string {
  const start =
    Date.parse(
      `${base}T12:00:00.000Z`
    );

  return new Date(
    start +
      days *
        86400000
  )
    .toISOString()
    .slice(
      0,
      10
    );
}

/* =========================================
   BASE ROW
========================================= */

function makeBaseRow(
  spec: DetectorBatchSpec,
  customer:
    string,
  amount:
    number,
  itemSuffix:
    string
): BusinessDataRow {
  const customerField =
    spec.customerField ??
    "Customer Name";

  const projectField =
    spec.projectField ??
    "Project Name";

  return {
    [customerField]:
      customer,

    [projectField]:
      `Batch Project ${spec.number}${itemSuffix}`,

    [spec.itemField]:
      `Test Item ${spec.number}${itemSuffix}`,

    [spec.amountField]:
      String(amount),
  };
}

/* =========================================
   STATUS AMOUNT PLAN
========================================= */

function buildStatusAmountPlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.statusField ||
    !spec.billingStatusField ||
    !spec.positiveStatuses?.length ||
    !spec.billedStatuses?.length
  ) {
    throw new Error(
      `Detector #${spec.number} is missing status_amount fields.`
    );
  }

  const amountOne =
    500 +
    index *
      100;

  const amountTwo =
    1500 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const firstPositive =
    spec
      .positiveStatuses[0];

  const secondPositive =
    spec
      .positiveStatuses[1] ??
    firstPositive;

  const billedStatus =
    spec
      .billedStatuses[0];

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  positiveOne[
    spec.statusField
  ] =
    firstPositive;

  positiveOne[
    spec.billingStatusField
  ] =
    "__not_billed__";

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  positiveTwo[
    spec.statusField
  ] =
    secondPositive;

  positiveTwo[
    spec.billingStatusField
  ] =
    "pending";

  const billedRow =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  billedRow[
    spec.statusField
  ] =
    firstPositive;

  billedRow[
    spec.billingStatusField
  ] =
    billedStatus;

  const invalidStatus =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  invalidStatus[
    spec.statusField
  ] =
    "__invalid_test_status__";

  invalidStatus[
    spec.billingStatusField
  ] =
    "__not_billed__";

  const noGuessing =
    makeBaseRow(
      spec,
      customerE,
      0,
      "E"
    );

  delete noGuessing[
    spec.amountField
  ];

  noGuessing[
    spec.statusField
  ] =
    firstPositive;

  noGuessing[
    spec.billingStatusField
  ] =
    "__not_billed__";

  noGuessing[
    "Invoice Amount"
  ] =
    "99999";

  noGuessing[
    "Order Total"
  ] =
    "88888";

  if (
    spec.dateField
  ) {
    for (
      const row
      of [
        positiveOne,
        positiveTwo,
        billedRow,
        invalidStatus,
        noGuessing,
      ]
    ) {
      row[
        spec.dateField
      ] =
        "2026-09-01";
    }
  }

  return {
    rows: [
      positiveOne,
      positiveTwo,
      billedRow,
      invalidStatus,
      noGuessing,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Positive #1",

    positiveTwoLabel:
      "Positive #2",

    negativeOneLabel:
      "Resolved/billed safety",

    negativeTwoLabel:
      "Invalid status safety",

    missingDataLabel:
      "No-guessing safety",
  };
}

/* =========================================
   COMPARISON PLAN
========================================= */

function buildComparisonPlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.leftField ||
    !spec.rightField ||
    !spec.operator
  ) {
    throw new Error(
      `Detector #${spec.number} is missing comparison fields.`
    );
  }

  const amountOne =
    700 +
    index *
      100;

  const amountTwo =
    1700 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const rightValue =
    100;

  const pass =
    passingValue(
      rightValue,
      spec.operator
    );

  const fail =
    failingValue(
      rightValue,
      spec.operator
    );

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  positiveOne[
    spec.leftField
  ] =
    String(pass);

  positiveOne[
    spec.rightField
  ] =
    String(rightValue);

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  positiveTwo[
    spec.leftField
  ] =
    String(
      passingValue(
        200,
        spec.operator
      )
    );

  positiveTwo[
    spec.rightField
  ] =
    "200";

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  negativeOne[
    spec.leftField
  ] =
    String(fail);

  negativeOne[
    spec.rightField
  ] =
    String(rightValue);

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    spec.leftField
  ] =
    "__invalid_number__";

  negativeTwo[
    spec.rightField
  ] =
    "100";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      7000,
      "E"
    );

  missingData[
    spec.leftField
  ] =
    String(pass);

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Comparison positive #1",

    positiveTwoLabel:
      "Comparison positive #2",

    negativeOneLabel:
      "Comparison false safety",

    negativeTwoLabel:
      "Invalid-number safety",

    missingDataLabel:
      "Missing comparison field safety",
  };
}

/* =========================================
   METRIC PLAN
   ratio / percentage / trend
========================================= */

function buildMetricPlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  const ruleType =
    getRuleType(
      spec
    );

  if (
    !spec.operator
  ) {
    throw new Error(
      `Detector #${spec.number} is missing operator.`
    );
  }

  const amountOne =
    800 +
    index *
      100;

  const amountTwo =
    1800 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  let threshold:
    number;

  let firstField:
    string;

  let secondField:
    string;

  if (
    ruleType ===
    "ratio"
  ) {
    if (
      !spec.numeratorField ||
      !spec.denominatorField ||
      spec.threshold ===
        undefined
    ) {
      throw new Error(
        `Detector #${spec.number} is missing ratio fields.`
      );
    }

    threshold =
      Number(
        spec.threshold
      );

    firstField =
      spec.numeratorField;

    secondField =
      spec.denominatorField;
  } else if (
    ruleType ===
    "percentage"
  ) {
    if (
      !spec.numeratorField ||
      !spec.denominatorField ||
      spec.thresholdPercent ===
        undefined
    ) {
      throw new Error(
        `Detector #${spec.number} is missing percentage fields.`
      );
    }

    threshold =
      Number(
        spec.thresholdPercent
      );

    firstField =
      spec.numeratorField;

    secondField =
      spec.denominatorField;
  } else {
    if (
      !spec.currentField ||
      !spec.baselineField ||
      spec.thresholdPercent ===
        undefined
    ) {
      throw new Error(
        `Detector #${spec.number} is missing trend fields.`
      );
    }

    threshold =
      Number(
        spec.thresholdPercent
      );

    firstField =
      spec.currentField;

    secondField =
      spec.baselineField;
  }

  const passMetric =
    passingValue(
      threshold,
      spec.operator
    );

  const failMetric =
    failingValue(
      threshold,
      spec.operator
    );

  function applyMetric(
    row:
      BusinessDataRow,
    metric:
      number
  ) {
    if (
      ruleType ===
      "ratio"
    ) {
      row[
        firstField
      ] =
        String(
          metric *
          100
        );

      row[
        secondField
      ] =
        "100";

      return;
    }

    if (
      ruleType ===
      "percentage"
    ) {
      row[
        firstField
      ] =
        String(
          metric
        );

      row[
        secondField
      ] =
        "100";

      return;
    }

    row[
      secondField
    ] =
      "1000";

    row[
      firstField
    ] =
      String(
        1000 *
        (
          1 +
          metric /
            100
        )
      );
  }

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  applyMetric(
    positiveOne,
    passMetric
  );

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  applyMetric(
    positiveTwo,
    passingValue(
      threshold,
      spec.operator
    )
  );

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  applyMetric(
    negativeOne,
    failMetric
  );

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    firstField
  ] =
    "100";

  negativeTwo[
    secondField
  ] =
    "0";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      7000,
      "E"
    );

  missingData[
    firstField
  ] =
    "100";

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      `${ruleType} positive #1`,

    positiveTwoLabel:
      `${ruleType} positive #2`,

    negativeOneLabel:
      `${ruleType} threshold safety`,

    negativeTwoLabel:
      `${ruleType} zero-baseline safety`,

    missingDataLabel:
      `${ruleType} missing-data safety`,
  };
}

/* =========================================
   THRESHOLD PLAN
========================================= */

function buildThresholdPlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.valueField ||
    !spec.operator ||
    spec.threshold ===
      undefined
  ) {
    throw new Error(
      `Detector #${spec.number} is missing threshold fields.`
    );
  }

  const amountOne =
    900 +
    index *
      100;

  const amountTwo =
    1900 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const threshold =
    Number(
      spec.threshold
    );

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  positiveOne[
    spec.valueField
  ] =
    String(
      passingValue(
        threshold,
        spec.operator
      )
    );

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  positiveTwo[
    spec.valueField
  ] =
    String(
      passingValue(
        threshold,
        spec.operator
      )
    );

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  negativeOne[
    spec.valueField
  ] =
    String(
      failingValue(
        threshold,
        spec.operator
      )
    );

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    spec.valueField
  ] =
    "__invalid_number__";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      7000,
      "E"
    );

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Threshold positive #1",

    positiveTwoLabel:
      "Threshold positive #2",

    negativeOneLabel:
      "Threshold false safety",

    negativeTwoLabel:
      "Invalid threshold value safety",

    missingDataLabel:
      "Missing threshold field safety",
  };
}

/* =========================================
   AGE PLAN
========================================= */

function buildAgePlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.dateField ||
    !spec.operator ||
    spec.daysThreshold ===
      undefined
  ) {
    throw new Error(
      `Detector #${spec.number} is missing age fields.`
    );
  }

  const amountOne =
    1000 +
    index *
      100;

  const amountTwo =
    2000 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const threshold =
    Number(
      spec.daysThreshold
    );

  let passingAge =
    passingValue(
      threshold,
      spec.operator
    );

  let failingAge =
    failingValue(
      threshold,
      spec.operator
    );


  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  positiveOne[
    spec.dateField
  ] =
    isoDateDaysAgo(
      passingAge
    );

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  positiveTwo[
    spec.dateField
  ] =
    isoDateDaysAgo(
      passingAge +
      (
        spec.operator === ">" ||
        spec.operator === ">="
          ? 5
          : 0
      )
    );

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  negativeOne[
    spec.dateField
  ] =
    isoDateDaysAgo(
      failingAge
    );

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    spec.dateField
  ] =
    "__invalid_date__";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      7000,
      "E"
    );

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Age positive #1",

    positiveTwoLabel:
      "Age positive #2",

    negativeOneLabel:
      "Age threshold safety",

    negativeTwoLabel:
      "Invalid-date safety",

    missingDataLabel:
      "Missing-date safety",
  };
}

/* =========================================
   MISSING VALUE PLAN
========================================= */

function buildMissingValuePlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.targetField
  ) {
    throw new Error(
      `Detector #${spec.number} is missing targetField.`
    );
  }

  const amountOne =
    1100 +
    index *
      100;

  const amountTwo =
    2100 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  positiveOne[
    spec.targetField
  ] =
    "";

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  negativeOne[
    spec.targetField
  ] =
    "present";

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    spec.targetField
  ] =
    "0";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      0,
      "E"
    );

  delete missingData[
    spec.amountField
  ];

  missingData[
    spec.targetField
  ] =
    "";

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Missing-value positive #1",

    positiveTwoLabel:
      "Missing-value positive #2",

    negativeOneLabel:
      "Present-value safety",

    negativeTwoLabel:
      "Non-empty-value safety",

    missingDataLabel:
      "Missing-loss-amount safety",
  };
}

/* =========================================
   DATE GAP PLAN
========================================= */

function buildDateGapPlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.startDateField ||
    !spec.endDateField ||
    !spec.operator ||
    spec.daysThreshold ===
      undefined
  ) {
    throw new Error(
      `Detector #${spec.number} is missing date_gap fields.`
    );
  }

  const amountOne =
    1200 +
    index *
      100;

  const amountTwo =
    2200 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const threshold =
    Number(
      spec.daysThreshold
    );

  const passGap =
    passingValue(
      threshold,
      spec.operator
    );

  const failGap =
    failingValue(
      threshold,
      spec.operator
    );

  const baseDate =
    "2026-01-01";

  function applyGap(
    row:
      BusinessDataRow,
    gap:
      number
  ) {
    row[
      spec.startDateField!
    ] =
      baseDate;

    row[
      spec.endDateField!
    ] =
      isoDatePlusDays(
        baseDate,
        gap
      );
  }

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  applyGap(
    positiveOne,
    passGap
  );

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  applyGap(
    positiveTwo,
    passGap
  );

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  applyGap(
    negativeOne,
    failGap
  );

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    spec.startDateField
  ] =
    "__invalid_date__";

  negativeTwo[
    spec.endDateField
  ] =
    "2026-05-01";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      7000,
      "E"
    );

  missingData[
    spec.startDateField
  ] =
    baseDate;

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Date-gap positive #1",

    positiveTwoLabel:
      "Date-gap positive #2",

    negativeOneLabel:
      "Date-gap threshold safety",

    negativeTwoLabel:
      "Invalid-date safety",

    missingDataLabel:
      "Missing-date safety",
  };
}

/* =========================================
   AGGREGATE PLAN
========================================= */

function buildAggregatePlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  if (
    !spec.groupField ||
    !spec.aggregateField ||
    !spec.operator ||
    spec.threshold ===
      undefined
  ) {
    throw new Error(
      `Detector #${spec.number} is missing aggregate fields.`
    );
  }

  const amountOne =
    1300 +
    index *
      100;

  const amountTwo =
    2300 +
    index *
      100;

  const customerA =
    `Batch Test ${spec.number}A`;

  const customerB =
    `Batch Test ${spec.number}B`;

  const customerC =
    `Batch Test ${spec.number}C`;

  const customerD =
    `Batch Test ${spec.number}D`;

  const customerE =
    `Batch Test ${spec.number}E`;

  const threshold =
    Number(
      spec.threshold
    );

  const pass =
    passingValue(
      threshold,
      spec.operator
    );

  const fail =
    failingValue(
      threshold,
      spec.operator
    );

  const positiveOne =
    makeBaseRow(
      spec,
      customerA,
      amountOne,
      "A"
    );

  positiveOne[
    spec.groupField
  ] =
    customerA;

  positiveOne[
    spec.aggregateField
  ] =
    String(pass);

  const positiveTwo =
    makeBaseRow(
      spec,
      customerB,
      amountTwo,
      "B"
    );

  positiveTwo[
    spec.groupField
  ] =
    customerB;

  positiveTwo[
    spec.aggregateField
  ] =
    String(pass);

  const negativeOne =
    makeBaseRow(
      spec,
      customerC,
      5000,
      "C"
    );

  negativeOne[
    spec.groupField
  ] =
    customerC;

  negativeOne[
    spec.aggregateField
  ] =
    String(fail);

  const negativeTwo =
    makeBaseRow(
      spec,
      customerD,
      6000,
      "D"
    );

  negativeTwo[
    spec.groupField
  ] =
    customerD;

  negativeTwo[
    spec.aggregateField
  ] =
    "__invalid_number__";

  const missingData =
    makeBaseRow(
      spec,
      customerE,
      7000,
      "E"
    );

  missingData[
    spec.groupField
  ] =
    customerE;

  return {
    rows: [
      positiveOne,
      positiveTwo,
      negativeOne,
      negativeTwo,
      missingData,
    ],

    positiveOneCustomer:
      customerA,

    positiveTwoCustomer:
      customerB,

    negativeOneCustomer:
      customerC,

    negativeTwoCustomer:
      customerD,

    missingDataCustomer:
      customerE,

    expectedLossOne:
      amountOne,

    expectedLossTwo:
      amountTwo,

    positiveOneLabel:
      "Aggregate positive #1",

    positiveTwoLabel:
      "Aggregate positive #2",

    negativeOneLabel:
      "Aggregate threshold safety",

    negativeTwoLabel:
      "Invalid aggregate safety",

    missingDataLabel:
      "Missing aggregate safety",
  };
}

/* =========================================
   TEST PLAN ROUTER
========================================= */

function createTestPlan(
  spec: DetectorBatchSpec,
  index: number
): TestPlan {
  const ruleType =
    getRuleType(
      spec
    );

  switch (
    ruleType
  ) {
    case "status_amount":
      return buildStatusAmountPlan(
        spec,
        index
      );

    case "comparison":
      return buildComparisonPlan(
        spec,
        index
      );

    case "ratio":
    case "percentage":
    case "trend":
      return buildMetricPlan(
        spec,
        index
      );

    case "threshold":
      return buildThresholdPlan(
        spec,
        index
      );

    case "age":
      return buildAgePlan(
        spec,
        index
      );

    case "missing_value":
      return buildMissingValuePlan(
        spec,
        index
      );

    case "date_gap":
      return buildDateGapPlan(
        spec,
        index
      );

    case "aggregate":
      return buildAggregatePlan(
        spec,
        index
      );

    default:
      throw new Error(
        `Unsupported ruleType: ${ruleType}`
      );
  }
}

/* =========================================
   ROUTE
========================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const fileName =
      request.nextUrl
        .searchParams
        .get(
          "file"
        );

    if (
      !fileName
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Missing ?file= parameter.",

          example:
            "/api/test-detector-batch?file=deep-leak-master-expansion.json",
        },
        {
          status:
            400,
        }
      );
    }

    registerDetectorCatalog();

    const specs =
      loadBatch(
        fileName
      );

    const industry =
      specs[0].industry;

    const sameIndustry =
      specs.every(
        (spec) =>
          spec.industry ===
          industry
      );

    if (
      !sameIndustry
    ) {
      throw new Error(
        "Every detector in a runtime batch must use the same storage industry."
      );
    }

    const profile =
      createProfile(
        industry
      );

    const firstNumber =
      specs[0].number;

    const lastNumber =
      specs[
        specs.length -
        1
      ].number;

    const expectedIds =
      specs.map(
        (spec) =>
          spec.id
      );

    /* =====================================
       CATALOG + REGISTRY
    ===================================== */

    const catalog =
      getDetectorCatalog();

    const catalogIds =
      catalog
        .filter(
          (detector) =>
            expectedIds.includes(
              detector.id
            )
        )
        .map(
          (detector) =>
            detector.id
        );

    const registryIds =
      getAllDetectors()
        .filter(
          (detector) =>
            expectedIds.includes(
              detector.id
            )
        )
        .map(
          (detector) =>
            detector.id
        );

    const supportedIds =
      getSupportedDetectors(
        profile
      )
        .filter(
          (detector) =>
            expectedIds.includes(
              detector.id
            )
        )
        .map(
          (detector) =>
            detector.id
        );

    /* =====================================
       TEST EACH TARGET DETECTOR
       IN ISOLATION
    ===================================== */

    const detectorTests = [];

    let totalRowsGenerated =
      0;

    let runnerFailures =
      0;

    let runnerErrors =
      0;

    for (
      const [
        index,
        spec,
      ]
      of specs.entries()
    ) {
      const plan =
        createTestPlan(
          spec,
          index
        );

      totalRowsGenerated +=
        plan.rows.length;

      const result =
        await runBusinessDetectors({
          profile,

          rows:
            plan.rows,

          now:
            TEST_NOW,
        });

      runnerFailures +=
        result.stats
          .detectorsFailed;

      runnerErrors +=
        result.stats
          .errors;

      const detectorResult =
        result.detectorResults.find(
          (resultItem) =>
            resultItem.detectorId ===
            spec.id
        );

      const leaks =
        detectorResult?.leaks ??
        [];

      const leakA =
        leaks.find(
          (leak) =>
            leak.customerName ===
            plan
              .positiveOneCustomer
        );

      const leakB =
        leaks.find(
          (leak) =>
            leak.customerName ===
            plan
              .positiveTwoCustomer
        );

      const leakC =
        leaks.find(
          (leak) =>
            leak.customerName ===
            plan
              .negativeOneCustomer
        );

      const leakD =
        leaks.find(
          (leak) =>
            leak.customerName ===
            plan
              .negativeTwoCustomer
        );

      const leakE =
        leaks.find(
          (leak) =>
            leak.customerName ===
            plan
              .missingDataCustomer
        );

      const firstPositivePassed =
        Boolean(
          leakA &&
          Math.abs(
            leakA.estimatedLoss -
              plan.expectedLossOne
          ) <
            0.01
        );

      const secondPositivePassed =
        Boolean(
          leakB &&
          Math.abs(
            leakB.estimatedLoss -
              plan.expectedLossTwo
          ) <
            0.01
        );

      const negativeOnePassed =
        !leakC;

      const negativeTwoPassed =
        !leakD;

      const missingDataPassed =
        !leakE;

      const leakCountPassed =
        leaks.length ===
        2;

      const catalogRegistered =
        catalogIds.includes(
          spec.id
        );

      const registryRegistered =
        registryIds.includes(
          spec.id
        );

      const supported =
        supportedIds.includes(
          spec.id
        );

      const ranPassed =
        Boolean(
          detectorResult &&
          detectorResult.ran &&
          detectorResult
            .errors
            .length ===
            0
        );

      const passed =
        firstPositivePassed &&
        secondPositivePassed &&
        negativeOnePassed &&
        negativeTwoPassed &&
        missingDataPassed &&
        leakCountPassed &&
        catalogRegistered &&
        registryRegistered &&
        supported &&
        ranPassed;

      detectorTests.push({
        number:
          spec.number,

        detectorId:
          spec.id,

        ruleType:
          getRuleType(
            spec
          ),

        scope:
          spec.scope ??
          "industry",

        passed,

        firstPositivePassed,

        secondPositivePassed,

        negativeOnePassed,

        negativeTwoPassed,

        missingDataPassed,

        leakCountPassed,

        catalogRegistered,

        registryRegistered,

        supported,

        ranPassed,

        leakCount:
          leaks.length,

        testLabels: {
          positiveOne:
            plan
              .positiveOneLabel,

          positiveTwo:
            plan
              .positiveTwoLabel,

          negativeOne:
            plan
              .negativeOneLabel,

          negativeTwo:
            plan
              .negativeTwoLabel,

          missingData:
            plan
              .missingDataLabel,
        },

        errors:
          detectorResult?.errors ??
          [],
      });
    }

    /* =====================================
       HEALTH
    ===================================== */

    const catalogPassed =
      specs.every(
        (spec) =>
          catalogIds.includes(
            spec.id
          )
      );

    const registryPassed =
      specs.every(
        (spec) =>
          registryIds.includes(
            spec.id
          )
      );

    const supportedPassed =
      specs.every(
        (spec) =>
          supportedIds.includes(
            spec.id
          )
      );

    const runtimePassed =
      detectorTests.every(
        (test) =>
          test.ranPassed
      );

    const testsPassed =
      detectorTests.every(
        (test) =>
          test.passed
      );

    const allPassed =
      catalogPassed &&
      registryPassed &&
      supportedPassed &&
      runtimePassed &&
      testsPassed;

    /* =====================================
       RULE TYPE SUMMARY
    ===================================== */

    const ruleTypes =
      Array.from(
        new Set(
          specs.map(
            (spec) =>
              getRuleType(
                spec
              )
          )
        )
      );

    const universalCount =
      specs.filter(
        (spec) =>
          spec.scope ===
          "universal"
      ).length;

    const industryCount =
      specs.length -
      universalCount;

    /* =====================================
       RESPONSE
    ===================================== */

    return NextResponse.json({
      success:
        allPassed,

      message:
        allPassed
          ? `Batch #${firstNumber} through #${lastNumber} passed all tests.`
          : `Batch #${firstNumber} through #${lastNumber} has a failing test.`,

      batch: {
        file:
          fileName,

        industry,

        firstNumber,

        lastNumber,

        detectorCount:
          specs.length,

        universalCount,

        industryCount,

        ruleTypes,

        rowsGenerated:
          totalRowsGenerated,
      },

      health: {
        generation:
          `${specs.length}/${specs.length}`,

        catalogPassed,

        registryPassed,

        supportedPassed,

        runtimePassed,

        testsPassed,

        detectorsExpected:
          specs.length,

        detectorsTested:
          detectorTests.length,

        runnerFailures,

        runnerErrors,
      },

      detectorTests,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown detector batch test error.",
      },
      {
        status:
          500,
      }
    );
  }
}
