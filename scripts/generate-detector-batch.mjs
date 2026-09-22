import fs from "node:fs";
import path from "node:path";
import { generateDetectorFromSpec } from "./generate-leak-detector.mjs";

function die(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    die(
      `Could not read batch JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function getRuleType(spec) {
  return spec.ruleType || "status_amount";
}

function missing(spec, fields) {
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

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

function validateSpec(spec, errors) {
  const baseMissing = missing(spec, [
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
  ]);

  if (baseMissing.length) {
    errors.push(
      `#${spec.number ?? "?"}: missing base fields: ${baseMissing.join(", ")}`
    );
  }

  if (!Number.isInteger(spec.number) || spec.number <= 0) {
    errors.push(`#${spec.number ?? "?"}: invalid detector number`);
  }

  if (
    spec.scope !== undefined &&
    spec.scope !== "industry" &&
    spec.scope !== "universal"
  ) {
    errors.push(`#${spec.number}: invalid scope "${spec.scope}"`);
  }

  const ruleType = getRuleType(spec);

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

  if (!(ruleType in ruleFields)) {
    errors.push(
      `#${spec.number}: unsupported ruleType "${ruleType}"`
    );

    return;
  }

  const ruleMissing = missing(
    spec,
    ruleFields[ruleType]
  );

  if (ruleMissing.length) {
    errors.push(
      `#${spec.number}: ${ruleType} missing: ${ruleMissing.join(", ")}`
    );
  }
}

const args = process.argv.slice(2);

const batchArg = args.find(
  (arg) => !arg.startsWith("--")
);

if (!batchArg) {
  console.log(
    "Usage: node scripts/generate-detector-batch.mjs <batch.json> [--force]"
  );

  process.exit(0);
}

const projectRootArg = args.find(
  (arg) => arg.startsWith("--project-root=")
);

const projectRoot = path.resolve(
  projectRootArg
    ? projectRootArg.split("=", 2)[1]
    : process.cwd()
);

const force = args.includes("--force");

const batchPath = path.resolve(batchArg);

const batch = readJson(batchPath);

if (!Array.isArray(batch) || batch.length === 0) {
  die("Batch file must contain a non-empty JSON array.");
}

const errors = [];

for (const spec of batch) {
  validateSpec(spec, errors);
}

const duplicateChecks = [
  [
    "numbers",
    batch.map((spec) => spec.number),
  ],
  [
    "IDs",
    batch.map((spec) => spec.id),
  ],
  [
    "exports",
    batch.map((spec) => spec.exportName),
  ],
  [
    "files",
    batch.map(
      (spec) => `${spec.industry}/${spec.fileName}`
    ),
  ],
];

for (const [label, values] of duplicateChecks) {
  const found = findDuplicates(values);

  if (found.length) {
    errors.push(
      `Duplicate ${label}: ${found.join(", ")}`
    );
  }
}

const catalogPath = path.join(
  projectRoot,
  "app/lib/business-intelligence/detector-catalog.ts"
);

if (!fs.existsSync(catalogPath)) {
  die(`Detector catalog not found: ${catalogPath}`);
}

const catalog = fs.readFileSync(
  catalogPath,
  "utf8"
);

for (const spec of batch) {
  const fileName = spec.fileName.endsWith(".ts")
    ? spec.fileName
    : `${spec.fileName}.ts`;

  const detectorPath = path.join(
    projectRoot,
    "app/lib/business-intelligence/detectors/industry",
    spec.industry,
    fileName
  );

  const hasId = catalog.includes(spec.id);
  const hasExport = catalog.includes(spec.exportName);
  const hasFile = fs.existsSync(detectorPath);

  if (hasId && !force) {
    errors.push(
      `#${spec.number}: detector ID already exists: ${spec.id}`
    );
  }

  if (hasExport && !hasId) {
    errors.push(
      `#${spec.number}: export collision: ${spec.exportName}`
    );
  }

  if (hasFile && !force) {
    errors.push(
      `#${spec.number}: detector file already exists`
    );
  }
}

if (errors.length) {
  console.error("\n❌ BATCH PREFLIGHT FAILED\n");

  for (const error of errors) {
    console.error(`• ${error}`);
  }

  console.error("\nNothing was generated.\n");
  process.exit(1);
}

const tempDir = path.join(
  projectRoot,
  ".detector-generator-temp"
);

fs.rmSync(tempDir, {
  recursive: true,
  force: true,
});

fs.mkdirSync(tempDir, {
  recursive: true,
});

let completed = 0;

try {
  for (const spec of batch) {
    const tempPath = path.join(
      tempDir,
      `detector-${spec.number}.json`
    );

    fs.writeFileSync(
      tempPath,
      JSON.stringify(spec, null, 2) + "\n",
      "utf8"
    );

    generateDetectorFromSpec(
      tempPath,
      {
        force,
        projectRoot,
      }
    );

    completed += 1;
  }
} finally {
  fs.rmSync(tempDir, {
    recursive: true,
    force: true,
  });
}

console.log(
  `\nBatch complete: ${completed}/${batch.length} detectors generated.\n`
);
