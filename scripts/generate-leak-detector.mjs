import fs from "node:fs";
import path from "node:path";

/* =========================================
   HELPERS
========================================= */

function die(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
  } catch (error) {
    die(
      `Could not read JSON spec: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
}

function tsString(value) {
  return JSON.stringify(String(value));
}

function normalizeStatus(value) {
  return String(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getScope(spec) {
  return spec.scope === "universal"
    ? "universal"
    : "industry";
}

function getRuleType(spec) {
  return spec.ruleType || "status_amount";
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

/* =========================================
   VALIDATION
========================================= */

function requireFields(
  spec,
  fields,
  label
) {
  const missing =
    fields.filter((field) => {
      const value =
        spec[field];

      if (Array.isArray(value)) {
        return value.length === 0;
      }

      return (
        value === undefined ||
        value === null ||
        value === ""
      );
    });

  if (missing.length) {
    die(
      `${label} requires: ${missing.join(", ")}`
    );
  }
}

function validateOperator(operator) {
  const allowed = [
    ">",
    ">=",
    "<",
    "<=",
    "=",
    "==",
    "===",
    "!=",
    "!==",
  ];

  if (!allowed.includes(operator)) {
    die(
      `Unsupported operator "${operator}". Allowed: ${allowed.join(", ")}`
    );
  }
}

function validateSpec(spec) {
  requireFields(
    spec,
    [
      "number",
      "id",
      "exportName",
      "fileName",
      "name",
      "description",
      "industry",
      "itemField",
      "amountField",
      "leakType",
      "category",
      "revenueType",
      "detectionReason",
    ],
    "Detector"
  );

  if (
    !Number.isInteger(spec.number) ||
    spec.number <= 0
  ) {
    die(
      "number must be a positive integer"
    );
  }

  if (
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
      spec.exportName
    )
  ) {
    die(
      "exportName is not a valid JavaScript identifier"
    );
  }

  if (
    spec.scope !== undefined &&
    spec.scope !== "industry" &&
    spec.scope !== "universal"
  ) {
    die(
      'scope must be "industry" or "universal"'
    );
  }

  const ruleType =
    getRuleType(spec);

  const allowedRules = [
    "status_amount",
    "comparison",
    "ratio",
    "threshold",
    "age",
    "missing_value",
    "date_gap",
    "percentage",
    "trend",
    "aggregate",
  ];

  if (
    !allowedRules.includes(ruleType)
  ) {
    die(
      `Unsupported ruleType "${ruleType}"`
    );
  }

  if (
    ruleType === "status_amount"
  ) {
    requireFields(
      spec,
      [
        "statusField",
        "billingStatusField",
        "positiveStatuses",
        "billedStatuses",
      ],
      "status_amount"
    );

    if (
      !Array.isArray(
        spec.positiveStatuses
      ) ||
      !Array.isArray(
        spec.billedStatuses
      )
    ) {
      die(
        "positiveStatuses and billedStatuses must be arrays"
      );
    }
  }

  if (
    ruleType === "comparison"
  ) {
    requireFields(
      spec,
      [
        "leftField",
        "rightField",
        "operator",
      ],
      "comparison"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "ratio"
  ) {
    requireFields(
      spec,
      [
        "numeratorField",
        "denominatorField",
        "operator",
        "threshold",
      ],
      "ratio"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "threshold"
  ) {
    requireFields(
      spec,
      [
        "valueField",
        "operator",
        "threshold",
      ],
      "threshold"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "age"
  ) {
    requireFields(
      spec,
      [
        "dateField",
        "operator",
        "daysThreshold",
      ],
      "age"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "missing_value"
  ) {
    requireFields(
      spec,
      [
        "targetField",
      ],
      "missing_value"
    );
  }

  if (
    ruleType === "date_gap"
  ) {
    requireFields(
      spec,
      [
        "startDateField",
        "endDateField",
        "operator",
        "daysThreshold",
      ],
      "date_gap"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "percentage"
  ) {
    requireFields(
      spec,
      [
        "numeratorField",
        "denominatorField",
        "operator",
        "thresholdPercent",
      ],
      "percentage"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "trend"
  ) {
    requireFields(
      spec,
      [
        "currentField",
        "baselineField",
        "operator",
        "thresholdPercent",
      ],
      "trend"
    );

    validateOperator(
      spec.operator
    );
  }

  if (
    ruleType === "aggregate"
  ) {
    requireFields(
      spec,
      [
        "groupField",
        "aggregateField",
        "operator",
        "threshold",
      ],
      "aggregate"
    );

    validateOperator(
      spec.operator
    );
  }
}

/* =========================================
   RULE FIELD COLLECTION
========================================= */

function getOptionalFields(
  spec
) {
  const customerField =
    spec.customerField ||
    "Customer Name";

  const projectField =
    spec.projectField ||
    "Project Name";

  return unique([
    customerField,
    projectField,

    spec.itemField,
    spec.amountField,

    spec.statusField,
    spec.billingStatusField,

    spec.dateField,

    spec.leftField,
    spec.rightField,

    spec.numeratorField,
    spec.denominatorField,

    spec.valueField,
    spec.targetField,

    spec.startDateField,
    spec.endDateField,

    spec.currentField,
    spec.baselineField,

    spec.groupField,
    spec.aggregateField,
  ]);
}

/* =========================================
   RULE RENDERING
========================================= */

function renderRowRule(
  spec
) {
  const ruleType =
    getRuleType(spec);

  if (
    ruleType === "status_amount"
  ) {
    const positive =
      spec.positiveStatuses.map(
        normalizeStatus
      );

    const billed =
      spec.billedStatuses.map(
        normalizeStatus
      );

    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const positiveStatuses = ${JSON.stringify(positive)};
  const billedStatuses = ${JSON.stringify(billed)};

  const status = normalizeText(
    row[${tsString(spec.statusField)}]
  );

  const billingStatus = normalizeText(
    row[${tsString(spec.billingStatusField)}]
  );

  if (!positiveStatuses.includes(status)) {
    return false;
  }

  if (billedStatuses.includes(billingStatus)) {
    return false;
  }

  return true;
}
`;
  }

  if (
    ruleType === "comparison"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const left = parseNumber(
    row[${tsString(spec.leftField)}]
  );

  const right = parseNumber(
    row[${tsString(spec.rightField)}]
  );

  if (left === null || right === null) {
    return false;
  }

  return compareNumbers(
    left,
    right,
    ${tsString(spec.operator)}
  );
}
`;
  }

  if (
    ruleType === "ratio"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const numerator = parseNumber(
    row[${tsString(spec.numeratorField)}]
  );

  const denominator = parseNumber(
    row[${tsString(spec.denominatorField)}]
  );

  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) {
    return false;
  }

  const ratio =
    numerator /
    denominator;

  return compareNumbers(
    ratio,
    ${Number(spec.threshold)},
    ${tsString(spec.operator)}
  );
}
`;
  }

  if (
    ruleType === "threshold"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const value = parseNumber(
    row[${tsString(spec.valueField)}]
  );

  if (value === null) {
    return false;
  }

  return compareNumbers(
    value,
    ${Number(spec.threshold)},
    ${tsString(spec.operator)}
  );
}
`;
  }

  if (
    ruleType === "age"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const daysOld = ageInDays(
    row[${tsString(spec.dateField)}]
  );

  if (daysOld === null) {
    return false;
  }

  return compareNumbers(
    daysOld,
    ${Number(spec.daysThreshold)},
    ${tsString(spec.operator)}
  );
}
`;
  }

  if (
    ruleType === "missing_value"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  return cleanText(
    row[${tsString(spec.targetField)}]
  ) === "";
}
`;
  }

  if (
    ruleType === "date_gap"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const gap = dateGapDays(
    row[${tsString(spec.startDateField)}],
    row[${tsString(spec.endDateField)}]
  );

  if (gap === null) {
    return false;
  }

  return compareNumbers(
    gap,
    ${Number(spec.daysThreshold)},
    ${tsString(spec.operator)}
  );
}
`;
  }

  if (
    ruleType === "percentage"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const numerator = parseNumber(
    row[${tsString(spec.numeratorField)}]
  );

  const denominator = parseNumber(
    row[${tsString(spec.denominatorField)}]
  );

  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) {
    return false;
  }

  const percentage =
    (
      numerator /
      denominator
    ) * 100;

  return compareNumbers(
    percentage,
    ${Number(spec.thresholdPercent)},
    ${tsString(spec.operator)}
  );
}
`;
  }

  if (
    ruleType === "trend"
  ) {
    return `
function matchesRule(row: Record<string, unknown>): boolean {
  const current = parseNumber(
    row[${tsString(spec.currentField)}]
  );

  const baseline = parseNumber(
    row[${tsString(spec.baselineField)}]
  );

  if (
    current === null ||
    baseline === null ||
    baseline === 0
  ) {
    return false;
  }

  const percentChange =
    (
      (
        current -
        baseline
      ) /
      Math.abs(baseline)
    ) * 100;

  return compareNumbers(
    percentChange,
    ${Number(spec.thresholdPercent)},
    ${tsString(spec.operator)}
  );
}
`;
  }

  return `
function matchesRule(): boolean {
  return false;
}
`;
}

/* =========================================
   STANDARD DETECTOR RENDERER
========================================= */

function renderDetector(
  spec
) {
  const ruleType =
    getRuleType(spec);

  const scope =
    getScope(spec);

  const universal =
    scope === "universal";

  const customerField =
    spec.customerField ||
    "Customer Name";

  const projectField =
    spec.projectField ||
    "Project Name";

  const recoveryRate =
    Number.isFinite(
      spec.recoveryRate
    )
      ? spec.recoveryRate
      : 0.9;

  const severityMedium =
    Number.isFinite(
      spec.severityMedium
    )
      ? spec.severityMedium
      : 7500;

  const severityHigh =
    Number.isFinite(
      spec.severityHigh
    )
      ? spec.severityHigh
      : 25000;

  const actionVerb =
    spec.recommendedActionVerb ||
    (
      ruleType ===
      "status_amount"
        ? "invoice"
        : "review"
    );

  const optionalFields =
    getOptionalFields(
      spec
    );

  const requiredFieldsByRule = {
    status_amount: [
      spec.amountField,
      spec.statusField,
      spec.billingStatusField,
    ],

    comparison: [
      spec.amountField,
      spec.leftField,
      spec.rightField,
    ],

    ratio: [
      spec.amountField,
      spec.numeratorField,
      spec.denominatorField,
    ],

    threshold: [
      spec.amountField,
      spec.valueField,
    ],

    age: [
      spec.amountField,
      spec.dateField,
    ],

    missing_value: [
      spec.amountField,
      spec.targetField,
    ],

    date_gap: [
      spec.amountField,
      spec.startDateField,
      spec.endDateField,
    ],

    percentage: [
      spec.amountField,
      spec.numeratorField,
      spec.denominatorField,
    ],

    trend: [
      spec.amountField,
      spec.currentField,
      spec.baselineField,
    ],

    aggregate: [
      spec.amountField,
      spec.groupField,
      spec.aggregateField,
    ],
  };

  const requiredFields = [
    ...new Set(
      (
        requiredFieldsByRule[
          ruleType
        ] || []
      ).filter(Boolean)
    ),
  ];

  const filteredOptionalFields =
    optionalFields.filter(
      (field) =>
        !requiredFields.includes(
          field
        )
    );

  const scopeBlock =
    universal
      ? `  scope: "universal",
  industries: [],
`
      : `  scope: "industry",
  industries: [${tsString(spec.industry)}],
`;

  const supportsBlock =
    universal
      ? `  supports() {
    return true;
  },`
      : `  supports(profile) {
    return profile.industry === ${tsString(spec.industry)};
  },`;

  const metadataIndustry =
    universal
      ? ""
      : `          industry: ${tsString(spec.industry)},
`;

  if (
    ruleType === "aggregate"
  ) {
    return renderAggregateDetector(
      spec,
      {
        customerField,
        projectField,
        recoveryRate,
        severityMedium,
        severityHigh,
        actionVerb,
        optionalFields,
        scope,
        scopeBlock,
        supportsBlock,
        metadataIndustry,
      }
    );
  }

  const rowRule =
    renderRowRule(
      spec
    );

  return `import type {
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
    .replace(/\\s+/g, " ")
    .trim();
}

function parseNumber(value: unknown): number | null {
  const cleaned = cleanText(value)
    .replace(/[$,%\\s,]/g, "");

  if (
    !cleaned ||
    !/^-?\\d+(\\.\\d+)?$/.test(cleaned)
  ) {
    return null;
  }

  const parsed =
    Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : null;
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
      return false;
  }
}

function parseDate(
  value: unknown
): number | null {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  const parsed =
    Date.parse(text);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function ageInDays(
  value: unknown
): number | null {
  const date =
    parseDate(value);

  if (date === null) {
    return null;
  }

  return (
    Date.now() -
    date
  ) / 86400000;
}

function dateGapDays(
  startValue: unknown,
  endValue: unknown
): number | null {
  const start =
    parseDate(startValue);

  const end =
    parseDate(endValue);

  if (
    start === null ||
    end === null
  ) {
    return null;
  }

  return (
    end -
    start
  ) / 86400000;
}

${rowRule}

export const ${spec.exportName}: BusinessLeakDetector = {
  id: ${tsString(spec.id)},
  name: ${tsString(spec.name)},
  description: ${tsString(spec.description)},
${scopeBlock}  requirements: {
    requiredFields: ${JSON.stringify(requiredFields)},
    optionalFields: ${JSON.stringify(filteredOptionalFields)},
  },

${supportsBlock}

  async detect(
    context: DetectorContext
  ): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach(
      (
        row,
        rowIndex
      ) => {
        if (
          !matchesRule(row)
        ) {
          return;
        }

        const amount =
          parseNumber(
            row[
              ${tsString(spec.amountField)}
            ]
          );

        if (
          amount === null ||
          amount <= 0
        ) {
          return;
        }

        const item =
          cleanText(
            row[
              ${tsString(spec.itemField)}
            ]
          );

        if (!item) {
          return;
        }

        const customerName =
          cleanText(
            row[
              ${tsString(customerField)}
            ]
          ) ||
          "Unknown Customer";

        const projectName =
          cleanText(
            row[
              ${tsString(projectField)}
            ]
          );

        const recovery =
          amount *
          ${recoveryRate};

        leaks.push({
          detectorId:
            ${tsString(spec.id)},

          leakType:
            ${tsString(spec.leakType)},

          title:
            \`\${customerName} has a ${String(spec.leakType).toLowerCase()}\`,

          description:
            \`\${customerName}'s \${item}\${projectName ? \` for \${projectName}\` : ""} triggered the ${ruleType} rule with a documented $\${amount.toFixed(2)} revenue impact.\`,

          category:
            ${tsString(spec.category)},

          severity:
            amount >=
            ${severityHigh}
              ? "high"
              : amount >=
                ${severityMedium}
              ? "medium"
              : "low",

          confidence:
            "high",

          estimatedLoss:
            amount,

          estimatedRecovery:
            recovery,

          customerName,

          sourceRowIndex:
            rowIndex,

          evidence: {
            projectName,
            item,
            amount,
            ruleType:
              ${tsString(ruleType)},
          },

          recommendedAction:
            \`${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} \${customerName}'s \${item} and address the documented $\${amount.toFixed(2)} revenue impact.\`,

          metadata: {
${metadataIndustry}            scope:
              ${tsString(scope)},

            ruleType:
              ${tsString(ruleType)},

            revenueType:
              ${tsString(spec.revenueType)},

            detectionReason:
              ${tsString(spec.detectionReason)},
          },
        });
      }
    );

    return {
      detectorId:
        ${tsString(spec.id)},

      ran:
        true,

      leaks,
      warnings,
      errors,
    };
  },
};
`;
}

/* =========================================
   AGGREGATE DETECTOR
========================================= */

function renderAggregateDetector(
  spec,
  config
) {
  const {
    recoveryRate,
    severityMedium,
    severityHigh,
    optionalFields,
    scope,
    scopeBlock,
    supportsBlock,
    metadataIndustry,
  } = config;

  return `import type {
  BusinessLeakDetector,
  DetectorContext,
  DetectorResult,
  DetectedBusinessLeak,
} from "../../../detector-types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseNumber(value: unknown): number | null {
  const cleaned = cleanText(value)
    .replace(/[$,%\\s,]/g, "");

  if (
    !cleaned ||
    !/^-?\\d+(\\.\\d+)?$/.test(cleaned)
  ) {
    return null;
  }

  const parsed =
    Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : null;
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
      return false;
  }
}

export const ${spec.exportName}: BusinessLeakDetector = {
  id: ${tsString(spec.id)},
  name: ${tsString(spec.name)},
  description: ${tsString(spec.description)},
${scopeBlock}  requirements: {
    requiredFields:
      ${JSON.stringify(requiredFields)},

    optionalFields:
      ${JSON.stringify(filteredOptionalFields)},
  },

${supportsBlock}

  async detect(
    context: DetectorContext
  ): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const groups =
      new Map<
        string,
        {
          total: number;
          amount: number;
          firstRowIndex: number;
        }
      >();

    context.rows.forEach(
      (
        row,
        rowIndex
      ) => {
        const groupName =
          cleanText(
            row[
              ${tsString(spec.groupField)}
            ]
          );

        if (!groupName) {
          return;
        }

        const aggregateValue =
          parseNumber(
            row[
              ${tsString(spec.aggregateField)}
            ]
          );

        if (
          aggregateValue === null
        ) {
          return;
        }

        const amount =
          parseNumber(
            row[
              ${tsString(spec.amountField)}
            ]
          ) ?? 0;

        const current =
          groups.get(
            groupName
          ) || {
            total: 0,
            amount: 0,
            firstRowIndex:
              rowIndex,
          };

        current.total +=
          aggregateValue;

        current.amount +=
          amount;

        groups.set(
          groupName,
          current
        );
      }
    );

    for (
      const [
        groupName,
        values,
      ]
      of groups.entries()
    ) {
      if (
        !compareNumbers(
          values.total,
          ${Number(spec.threshold)},
          ${tsString(spec.operator)}
        )
      ) {
        continue;
      }

      const amount =
        values.amount > 0
          ? values.amount
          : Math.abs(
              values.total
            );

      if (
        amount <= 0
      ) {
        continue;
      }

      const recovery =
        amount *
        ${recoveryRate};

      leaks.push({
        detectorId:
          ${tsString(spec.id)},

        leakType:
          ${tsString(spec.leakType)},

        title:
          \`\${groupName} has a ${String(spec.leakType).toLowerCase()}\`,

        description:
          \`\${groupName} triggered the aggregate rule with an aggregate value of \${values.total.toFixed(2)} and a documented $\${amount.toFixed(2)} revenue impact.\`,

        category:
          ${tsString(spec.category)},

        severity:
          amount >=
          ${severityHigh}
            ? "high"
            : amount >=
              ${severityMedium}
            ? "medium"
            : "low",

        confidence:
          "high",

        estimatedLoss:
          amount,

        estimatedRecovery:
          recovery,

        customerName:
          groupName,

        sourceRowIndex:
          values.firstRowIndex,

        evidence: {
          group:
            groupName,

          aggregateValue:
            values.total,

          threshold:
            ${Number(spec.threshold)},

          operator:
            ${tsString(spec.operator)},

          ruleType:
            "aggregate",
        },

        recommendedAction:
          \`Review \${groupName} and address the detected aggregate revenue leak.\`,

        metadata: {
${metadataIndustry}          scope:
            ${tsString(scope)},

          ruleType:
            "aggregate",

          revenueType:
            ${tsString(spec.revenueType)},

          detectionReason:
            ${tsString(spec.detectionReason)},
        },
      });
    }

    return {
      detectorId:
        ${tsString(spec.id)},

      ran:
        true,

      leaks,
      warnings,
      errors,
    };
  },
};
`;
}

/* =========================================
   CATALOG
========================================= */

function backupFile(
  filePath
) {
  const stamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      );

  const backup =
    `${filePath}.${stamp}.bak`;

  fs.copyFileSync(
    filePath,
    backup
  );

  return backup;
}

function patchCatalog(
  projectRoot,
  spec,
  importPath
) {
  const catalogPath =
    path.join(
      projectRoot,
      "app/lib/business-intelligence/detector-catalog.ts"
    );

  if (
    !fs.existsSync(
      catalogPath
    )
  ) {
    die(
      `Catalog not found: ${catalogPath}`
    );
  }

  let text =
    fs.readFileSync(
      catalogPath,
      "utf8"
    );

  const hasId =
    text.includes(
      spec.id
    );

  const hasExport =
    text.includes(
      spec.exportName
    );

  if (
    hasExport &&
    !hasId
  ) {
    die(
      `Catalog export collision: ${spec.exportName}`
    );
  }

  if (
    hasExport &&
    hasId
  ) {
    console.log(
      `Catalog already references ${spec.exportName}; skipping patch.`
    );

    return;
  }

  const typeImportIndex =
    text.lastIndexOf(
      "import type {"
    );

  if (
    typeImportIndex <
    0
  ) {
    die(
      "Could not locate final import type block in detector-catalog.ts"
    );
  }

  const importBlock =
    `import {\n  ${spec.exportName},\n} from ${JSON.stringify(importPath)};\n\n`;

  text =
    text.slice(
      0,
      typeImportIndex
    ) +
    importBlock +
    text.slice(
      typeImportIndex
    );

  const catalogStart =
    text.indexOf(
      "const detectorCatalog"
    );

  const arrayEnd =
    text.indexOf(
      "\n];",
      catalogStart
    );

  if (
    catalogStart <
      0 ||
    arrayEnd <
      0
  ) {
    die(
      "Could not locate detectorCatalog array"
    );
  }

  const entry =
    `\n\n  /**\n   * Detector #${spec.number}\n   */\n  ${spec.exportName},`;

  text =
    text.slice(
      0,
      arrayEnd
    ) +
    entry +
    text.slice(
      arrayEnd
    );

  const backup =
    backupFile(
      catalogPath
    );

  fs.writeFileSync(
    catalogPath,
    text,
    "utf8"
  );

  console.log(
    `Catalog patched. Backup: ${backup}`
  );
}

/* =========================================
   GENERATION
========================================= */

export function generateDetectorFromSpec(
  specPath,
  options = {}
) {
  const projectRoot =
    path.resolve(
      options.projectRoot ||
      process.cwd()
    );

  const spec =
    readJson(
      path.resolve(
        specPath
      )
    );

  validateSpec(
    spec
  );

  const industryDir =
    path.join(
      projectRoot,
      "app/lib/business-intelligence/detectors/industry",
      spec.industry
    );

  fs.mkdirSync(
    industryDir,
    {
      recursive:
        true,
    }
  );

  const fileName =
    spec.fileName.endsWith(
      ".ts"
    )
      ? spec.fileName
      : `${spec.fileName}.ts`;

  const outputPath =
    path.join(
      industryDir,
      fileName
    );

  if (
    fs.existsSync(
      outputPath
    ) &&
    !options.force
  ) {
    die(
      `Detector already exists: ${outputPath}. Use --force only if intentional.`
    );
  }

  fs.writeFileSync(
    outputPath,
    renderDetector(
      spec
    ),
    "utf8"
  );

  if (
    !options.noCatalog
  ) {
    const importPath =
      `./detectors/industry/${spec.industry}/${fileName.replace(/\.ts$/, "")}`;

    patchCatalog(
      projectRoot,
      spec,
      importPath
    );
  }

  console.log(
    `Generated detector #${spec.number}: ${outputPath}`
  );

  return outputPath;
}

/* =========================================
   CLI
========================================= */

function cli() {
  const args =
    process.argv.slice(
      2
    );

  if (
    !args.length
  ) {
    console.log(
      "Usage: node scripts/generate-leak-detector.mjs <spec.json> [--force] [--no-catalog]"
    );

    process.exit(0);
  }

  const specPath =
    args.find(
      (arg) =>
        !arg.startsWith(
          "--"
        )
    );

  const projectRootArg =
    args.find(
      (arg) =>
        arg.startsWith(
          "--project-root="
        )
    );

  generateDetectorFromSpec(
    specPath,
    {
      force:
        args.includes(
          "--force"
        ),

      noCatalog:
        args.includes(
          "--no-catalog"
        ),

      projectRoot:
        projectRootArg
          ? projectRootArg.split(
              "=",
              2
            )[1]
          : process.cwd(),
    }
  );
}

if (
  import.meta.url ===
  `file://${process.argv[1]}`
) {
  cli();
}
