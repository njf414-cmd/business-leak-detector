import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const masterArg = process.argv[2];

function die(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  return result.status === 0;
}

function dupes(values) {
  const seen = new Set();
  const out = new Set();

  for (const value of values) {
    if (seen.has(value)) out.add(value);
    seen.add(value);
  }

  return [...out];
}

function safeName(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

if (!masterArg) {
  console.log(
    "Usage: node scripts/build-all-detectors.mjs detector-specs/master-expansion.json"
  );

  pcess.exit(0);
}

const masterPath = path.resolve(
  root,
  masterArg
);

if (!fs.existsSync(masterPath)) {
  die(
    `Master file not found: ${masterPath}`
  );
}

let specs;

try {
  specs = JSON.parse(
    fs.readFileSync(
      masterPath,
      "utf8"
    )
  );
} catch (error) {
  die(
    `Could not parse master JSON: ${
      error instanceof Error
        ? error.message
        : String(error)
    }`
  );
}

if (
  !Array.isArray(specs) ||
  specs.length === 0
) {
  die(
    "Master spec must be a non-empty JSON array."
  );
}

console.log(
  "\n========================================"
);

console.log(
  " BUSINESS LEAK DETECTOR MASTER BUILDER"
);

console.log(
  "========================================\n"
);

console.log(
  `Master detectors: ${specs.length}`
);

const errors = [];

function getRuleType(spec) {
  return spec.ruleType || "status_amount";
}

function missingFields(spec, fields) {
  return fields.filter((field) => {
    const value = spec[field];

    return (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  });
}

const ruleFields = {
  status_amount: [
    "statusField",
    "billingStatusField",
    "positiveStatuses",
    "billedStatuses",
  ],

  comparison: [
    "leftField",
    "rightField",
    "operator",
  ],

  ratio: [
    "numeratorField",
    "denominatorField",
    "operator",
    "threshold",
  ],

  threshold: [
    "valueField",
    "operator",
    "threshold",
  ],

  age: [
    "dateField",
    "operator",
    "daysThreshold",
  ],

  missing_value: [
    "targetField",
  ],

  date_gap: [
    "startDateField",
    "endDateField",
    "operator",
    "daysThreshold",
  ],

  percentage: [
    "numeratorField",
    "denominatorField",
    "operator",
    "thresholdPercent",
  ],

  trend: [
    "currentField",
    "baselineField",
    "operator",
    "thresholdPercent",
  ],

  aggregate: [
    "groupField",
    "aggregateField",
    "operator",
    "threshold",
  ],
};

const baseFields = [
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
];

for (const [index, spec] of specs.entries()) {
  if (
    !spec ||
    typeof spec !== "object" ||
    Array.isArray(spec)
  ) {
    errors.push(
      `Index ${index}: invalid detector spec`
    );

    continue;
  }

  const baseMissing =
    missingFields(
      spec,
      baseFields
    );

  if (baseMissing.length) {
    errors.push(
      `#${spec.number ?? index}: missing base fields: ${baseMissing.join(", ")}`
    );
  }

  if (
    !Number.isInteger(spec.number) ||
    spec.number <= 0
  ) {
    errors.push(
      `Index ${index}: detector number must be a positive integer`
    );
  }

  if (
    spec.scope !== undefined &&
    spec.scope !== "industry" &&
    spec.scope !== "universal"
  ) {
    errors.push(
      `#${spec.number}: invalid scope "${spec.scope}"`
    );
  }

  const ruleType =
    getRuleType(spec);

  if (!(ruleType in ruleFields)) {
    errors.push(
      `#${spec.number}: unsupported ruleType "${ruleType}"`
    );

    continue;
  }

  const ruleMissing =
    missingFields(
      spec,
      ruleFields[ruleType]
    );

  if (ruleMissing.length) {
    errors.push(
      `#${spec.number}: ${ruleType} missing: ${ruleMissing.join(", ")}`
    );
  }
}

const checks = [
  [
    "numbers",
    specs.map(
      (spec) => spec.number
    ),
  ],
  [
    "IDs",
    specs.map(
      (spec) => spec.id
    ),
  ],
  [
    "exports",
    specs.map(
      (spec) => spec.exportName
    ),
  ],
  [
    "files",
    specs.map(
      (spec) =>
        `${spec.industry}/${spec.fileName}`
    ),
  ],
];

for (
  const [label, values]
  of checks
) {
  const found =
    dupes(values);

  if (found.length) {
    errors.push(
      `Duplicate ${label}: ${found.join(", ")}`
    );
  }
}

if (errors.length) {
  console.error(
    "\n❌ MASTER VALIDATION FAILED\n"
  );

  for (
    const error
    of errors
  ) {
    console.error(
      `• ${error}`
    );
  }

  console.error(
    "\nNothing was generated.\n"
  );

  process.exit(1);
}

console.log(
  "✅ Master structure valid"
);

const catalogPath = path.join(
  root,
  "app/lib/business-intelligence/detector-catalog.ts"
);

if (
  !fs.existsSync(
    catalogPath
  )
) {
  die(
    `Detector catalog not found: ${catalogPath}`
  );
}

const catalog =
  fs.readFileSync(
    catalogPath,
    "utf8"
  );

const existing = [];
const fresh = [];
const conflicts = [];

for (
  const spec
  of specs
) {
  const detectorPath =
    path.join(
      root,
      "app/lib/business-intelligence/detectors/industry",
      spec.industry,
      spec.fileName
    );

  const hasId =
    catalog.includes(
      spec.id
    );

  const hasExport =
    catalog.includes(
      spec.exportName
    );

  const hasFile =
    fs.existsSync(
      detectorPath
    );

  if (
    hasId &&
    hasExport &&
    hasFile
  ) {
    existing.push(
      spec
    );
  } else if (
    !hasId &&
    !hasExport &&
    !hasFile
  ) {
    fresh.push(
      spec
    );
  } else {
    conflicts.push({
      spec,
      hasId,
      hasExport,
      hasFile,
    });
  }
}

console.log(
  `Already complete: ${existing.length}`
);

console.log(
  `New detectors:    ${fresh.length}`
);

console.log(
  `Conflicts:        ${conflicts.length}`
);

if (conflicts.length) {
  console.error(
    "\n❌ PROJECT CONFLICTS FOUND\n"
  );

  for (
    const item
    of conflicts
  ) {
    console.error(
      `#${item.spec.number} ${item.spec.id}`
    );

    console.error(
      `  Catalog ID:  ${item.hasId}`
    );

    console.error(
      `  Export:      ${item.hasExport}`
    );

    console.error(
      `  File:        ${item.hasFile}\n`
    );
  }

  die(
    "Fix conflicts before bulk generation."
  );
}

const groups =
  new Map();

for (
  const spec
  of fresh
) {
  if (
    !groups.has(
      spec.industry
    )
  ) {
    groups.set(
      spec.industry,
      []
    );
  }

  groups
    .get(
      spec.industry
    )
    .push(
      spec
    );
}

for (
  const group
  of groups.values()
) {
  group.sort(
    (a, b) =>
      a.number - b.number
  );
}

console.log(
  `Industries to build: ${groups.size}`
);

if (
  fresh.length === 0
) {
  console.log(
    "\n✅ Everything in the mastele already exists.\n"
  );

  process.exit(0);
}

const specDir =
  path.join(
    root,
    "detector-specs"
  );

fs.mkdirSync(
  specDir,
  {
    recursive: true,
  }
);

const tempFiles = [];
const results = [];

try {
  for (
    const [
      industry,
      group,
    ]
    of groups.entries()
  ) {
    const tempName =
      `master-temp-${safeName(industry)}.json`;

    const tempPath =
      path.join(
        specDir,
        tempName
      );

    tempFiles.push(
      tempPath
    );

    fs.writeFileSync(
      tempPath,
      JSON.stringify(
        group,
        null,
        2
      ) + "\n",
      "utf8"
    );

    console.log(
      "\n========================================"
    );

    console.log(
      ` BUILDING ${industry}`
    );

    console.log(
      "========================================\n"
    );

    console.log(
      `Detectors: ${group.length}`
    );

    console.log(
      `Range: #${group[0].number} through #${group[group.length - 1].number}`
    );

    const passed =
      run(
        "node",
        [
          "scripts/build-and-test-detector-batch.mjs",
          `detector-specs/${tempName}`,
        ]
      );

    results.push({
      industry,
      count:
        group.length,
      passed,
    });

    if (!passed) {
      console.error(
        `\n❌ ${industry} failed. Stopping master build.`
      );

      break;
    }

    console.log(
      `\n✅ ${industry} passed`
    );
  }
} finally {
  for (
    const file
    of tempFiles
  ) {
    if (
      fs.existsSync(
        file
      )
    ) {
      fs.unlinkSync(
        file
      );
    }
  }
}

const passedResults =
  results.filter(
    (result) =>
      result.passed
  );

const failedResults =
  results.filter(
    (result) =>
      !result.passed
  );

const verifiedCount =
  passedResults.reduce(
    (
      total,
      result
    ) =>
      total +
      result.count,
    0
  );

if (
  failedResults.length ||
  results.length !==
    groups.size
) {
  console.log(
    "\n===================================="
  );

  console.log(
    " MASTER BUILD SUMMARY"
  );

  console.log(
    "========================================\n"
  );

  console.log(
    `Already complete:  ${existing.length}`
  );

  console.log(
    `Newly verified:    ${verifiedCount}`
  );

  console.log(
    `Industries passed: ${passedResults.length}/${groups.size}`
  );

  console.log(
    "\n❌ MASTER BUILD INCOMPLETE\n"
  );

  process.exit(1);
}

const tscPath =
  path.join(
    root,
    "node_modules",
    ".bin",
    "tsc"
  );

if (
  !fs.existsSync(
    tscPath
  )
) {
  die(
    `TypeScript compiler not found: ${tscPath}`
  );
}

if (
  !run(
    tscPath,
    [
      "--noEmit",
    ]
  )
) {
  die(
    "Final TypeScript validation failed."
  );
}

console.log(
  "\n========================================"
);

console.log(
  " MASTER BUILD SUMMARY"
);

console.log(
  "========================================\n"
);

console.log(
  `Master detectors:  ${specs.length}`
);

console.log(
  `Already complete:  ${existing.length}`
);

console.log(
  `Newly verified:    ${verifiedCount}`
);

console.log(
  `Industries passed: ${passedResults.length}/${groups.size}`
);

console.log(
  `Total represented: ${existing.length + verifiedCount}/${specs.length}`
);

console.log(
  "\n✅ MASTER BUILD PASSED\n"
);
