import fs from "node:fs";
import path from "node:path";
import {
  spawn,
  spawnSync,
} from "node:child_process";

/* ================================== */
/* CONFIG */
/* ================================== */

const PROJECT_ROOT =
  process.cwd();

const batchArgument =
  process.argv[2];

if (!batchArgument) {
  console.error(`
❌ Missing detector batch file.

Example:

node scripts/build-and-test-detector-batch.mjs detector-specs/real-estate-batch.json
`);

  process.exit(1);
}

/* ================================== */
/* RESOLVE BATCH */
/* ================================== */

const batchPath =
  path.isAbsolute(batchArgument)
    ? batchArgument
    : path.join(
        PROJECT_ROOT,
        batchArgument
      );

if (
  !fs.existsSync(
    batchPath
  )
) {
  console.error(
    `❌ Batch file not found:\n${batchPath}`
  );

  process.exit(1);
}

const batchFileName =
  path.basename(
    batchPath
  );

let specs;

try {
  specs =
    JSON.parse(
      fs.readFileSync(
        batchPath,
        "utf8"
      )
    );
} catch (error) {
  console.error(
    "❌ Could not parse batch JSON."
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
}

if (
  !Array.isArray(specs) ||
  specs.length === 0
) {
  console.error(
    "❌ Batch contains no detectors."
  );

  process.exit(1);
}

/* ================================== */
/* BASIC VALIDATION */
/* ================================== */

const validationErrors = [];

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

for (
  const [
    index,
    spec,
  ] of specs.entries()
) {
  if (
    !spec ||
    typeof spec !== "object" ||
    Array.isArray(spec)
  ) {
    validationErrors.push(
      `Detector index ${index}: invalid detector spec`
    );

    continue;
  }

  const baseMissing =
    missingFields(
      spec,
      baseFields
    );

  if (baseMissing.length) {
    validationErrors.push(
      `Detector #${spec.number ?? index}: missing base fields: ${baseMissing.join(", ")}`
    );
  }

  if (
    !Number.isInteger(spec.number) ||
    spec.number <= 0
  ) {
    validationErrors.push(
      `Detector index ${index}: number must be a positive integer`
    );
  }

  if (
    spec.scope !== undefined &&
    spec.scope !== "industry" &&
    spec.scope !== "universal"
  ) {
    validationErrors.push(
      `Detector #${spec.number}: invalid scope "${spec.scope}"`
    );
  }

  const ruleType =
    getRuleType(spec);

  if (!(ruleType in ruleFields)) {
    validationErrors.push(
      `Detector #${spec.number}: unsupported ruleType "${ruleType}"`
    );

    continue;
  }

  const ruleMissing =
    missingFields(
      spec,
      ruleFields[ruleType]
    );

  if (ruleMissing.length) {
    validationErrors.push(
      `Detector #${spec.number}: ${ruleType} missing: ${ruleMissing.join(", ")}`
    );
  }
}

const industries =
  [
    ...new Set(
      specs.map(
        (spec) =>
          spec.industry
      )
    ),
  ];

if (
  industries.length !==
  1
) {
  validationErrors.push(
    "Every detector in one batch must use the same industry."
  );
}

const numbers =
  specs
    .map(
      (spec) =>
        spec.number
    )
    .sort(
      (a, b) =>
        a - b
    );

const detectorIds =
  specs.map(
    (spec) =>
      spec.id
  );

if (
  new Set(
    numbers
  ).size !==
  numbers.length
) {
  validationErrors.push(
    "Duplicate detector numbers found."
  );
}

if (
  new Set(
    detectorIds
  ).size !==
  detectorIds.length
) {
  validationErrors.push(
    "Duplicate detector IDs found."
  );
}

if (
  validationErrors.length >
  0
) {
  console.error(
    "\n❌ BATCH VALIDATION FAILED\n"
  );

  validationErrors.forEach(
    (error) =>
      console.error(
        `• ${error}`
      )
  );

  process.exit(1);
}

/* ================================== */
/* BATCH INFORMATION */
/* ================================== */

const firstNumber =
  Math.min(
    ...numbers
  );

const lastNumber =
  Math.max(
    ...numbers
  );

const industry =
  industries[0];

console.log(`
========================================
 BUSINESS LEAK DETECTOR BATCH BUILDER
========================================

Batch:
  #${firstNumber} through #${lastNumber}

Industry:
  ${industry}

Detectors:
  ${specs.length}

File:
  ${batchFileName}
`);

/* ================================== */
/* COMMAND RUNNER */
/* ================================== */

function runCommand(
  command,
  args,
  label
) {
  console.log(
    `\n▶ ${label}\n`
  );

  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          PROJECT_ROOT,

        stdio:
          "inherit",

        shell:
          false,
      }
    );

  if (
    result.error
  ) {
    console.error(
      `\n❌ ${label} failed to start.`
    );

    console.error(
      result.error.message
    );

    process.exit(1);
  }

  if (
    result.status !==
    0
  ) {
    console.error(
      `\n❌ ${label} FAILED`
    );

    process.exit(
      result.status ||
        1
    );
  }

  console.log(
    `\n✅ ${label} PASSED`
  );
}

/* ================================== */
/* STEP 1 — GENERATE DETECTORS */
/* ================================== */

runCommand(
  process.execPath,
  [
    path.join(
      PROJECT_ROOT,
      "scripts",
      "generate-detector-batch.mjs"
    ),
    batchPath,
  ],
  "Detector generation"
);

/* ================================== */
/* STEP 2 — TYPESCRIPT */
/* ================================== */

const tscPath =
  path.join(
    PROJECT_ROOT,
    "node_modules",
    ".bin",
    "tsc"
  );

if (
  !fs.existsSync(
    tscPath
  )
) {
  console.error(
    "\n❌ TypeScript compiler not found."
  );

  console.error(
    "Run npm install first."
  );

  process.exit(1);
}

runCommand(
  tscPath,
  [
    "--noEmit",
  ],
  "TypeScript validation"
);

/* ================================== */
/* DEV SERVER HELPERS */
/* ================================== */

const BASE_URL =
  "http://localhost:3000";

async function serverIsRunning() {
  try {
    const response =
      await fetch(
        BASE_URL,
        {
          signal:
            AbortSignal.timeout(
              2000
            ),
        }
      );

    return Boolean(
      response
    );
  } catch {
    return false;
  }
}

async function waitForServer(
  timeoutMs =
    45000
) {
  const started =
    Date.now();

  while (
    Date.now() -
      started <
    timeoutMs
  ) {
    if (
      await serverIsRunning()
    ) {
      return true;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1000
        )
    );
  }

  return false;
}

/* ================================== */
/* STEP 3 — START DEV SERVER IF NEEDED */
/* ================================== */

let startedDevServer =
  false;

let devServer =
  null;

if (
  !(await serverIsRunning())
) {
  console.log(
    "\n▶ Starting Next.js dev server..."
  );

  devServer =
    spawn(
      "npm",
      [
        "run",
        "dev",
      ],
      {
        cwd:
          PROJECT_ROOT,

        stdio: [
          "ignore",
          "inherit",
          "inherit",
        ],

        shell:
          false,
      }
    );

  startedDevServer =
    true;

  const serverReady =
    await waitForServer();

  if (
    !serverReady
  ) {
    console.error(
      "\n❌ Dev server did not start within 45 seconds."
    );

    if (
      devServer
    ) {
      devServer.kill(
        "SIGTERM"
      );
    }

    process.exit(1);
  }

  console.log(
    "\n✅ Dev server ready"
  );
} else {
  console.log(
    "\n✅ Existing dev server detected"
  );
}

/* ================================== */
/* CLEANUP */
/* ================================== */

function cleanup() {
  if (
    startedDevServer &&
    devServer &&
    !devServer.killed
  ) {
    devServer.kill(
      "SIGTERM"
    );
  }
}

process.on(
  "SIGINT",
  () => {
    cleanup();

    process.exit(
      130
    );
  }
);

process.on(
  "SIGTERM",
  () => {
    cleanup();

    process.exit(
      143
    );
  }
);

/* ================================== */
/* STEP 4 — RUNTIME TEST */
/* ================================== */

console.log(
  "\n▶ Runtime detector testing\n"
);

const runtimeUrl =
  `${BASE_URL}/api/test-detector-batch?file=${encodeURIComponent(
    batchFileName
  )}`;

let runtimeResponse;
let runtimeData;

try {
  runtimeResponse =
    await fetch(
      runtimeUrl,
      {
        signal:
          AbortSignal.timeout(
            60000
          ),

        cache:
          "no-store",
      }
    );

  runtimeData =
    await runtimeResponse.json();
} catch (error) {
  cleanup();

  console.error(
    "\n❌ Runtime test request failed."
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
}

/* ================================== */
/* PRINT RESULTS */
/* ================================== */

console.log(
  "========================================"
);

console.log(
  ` Batch #${firstNumber}–#${lastNumber} Results`
);

console.log(
  "========================================"
);

console.log(
  `Industry:       ${industry}`
);

console.log(
  `Generated:      ${specs.length}/${specs.length}`
);

console.log(
  `TypeScript:     PASS`
);

console.log(
  `Catalog:        ${
    runtimeData
      ?.health
      ?.catalogPassed
      ? "PASS"
      : "FAIL"
  }`
);

console.log(
  `Registry:       ${
    runtimeData
      ?.health
      ?.registryPassed
      ? "PASS"
      : "FAIL"
  }`
);

console.log(
  `Supported:      ${
    runtimeData
      ?.health
      ?.supportedPassed
      ? "PASS"
      : "FAIL"
  }`
);

console.log(
  `Runtime:        ${
    runtimeData
      ?.health
      ?.runtimePassed
      ? "PASS"
      : "FAIL"
  }`
);

console.log(
  `Detector tests: ${
    runtimeData
      ?.health
      ?.testsPassed
      ? "PASS"
      : "FAIL"
  }`
);

console.log(
  `Rows generated: ${
    runtimeData
      ?.batch
      ?.rowsGenerated ??
    "unknown"
  }`
);

console.log(
  `Errors:         ${
    runtimeData
      ?.health
      ?.errors ??
    "unknown"
  }`
);

console.log(
  "========================================"
);

/* ================================== */
/* FAILURE REPORT */
/* ================================== */

if (
  !runtimeResponse.ok ||
  !runtimeData?.success
) {
  console.error(
    "\n❌ BATCH FAILED\n"
  );

  console.error(
    runtimeData?.message ||
      runtimeData?.error ||
      "Unknown runtime test failure."
  );

  const failedTests =
    Array.isArray(
      runtimeData
        ?.detectorTests
    )
      ? runtimeData
          .detectorTests
          .filter(
            (test) =>
              !test.passed
          )
      : [];

  if (
    failedTests.length >
    0
  ) {
    console.error(
      "\nFailed detectors:"
    );

    for (
      const test
      of failedTests
    ) {
      console.error(
        `\n#${test.number} ${test.detectorId}`
      );

      console.error(
        `  Positive #1: ${
          test.firstPositivePassed
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Positive #2: ${
          test.secondPositivePassed
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Billed safety: ${
          test.billedSafetyPassed
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Invalid status: ${
          test.invalidStatusSafetyPassed
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  No guessing: ${
          test.noGuessingPassed
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Leak count: ${
          test.leakCountPassed
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Catalog: ${
          test.catalogRegistered
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Registry: ${
          test.registryRegistered
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Supported: ${
          test.supported
            ? "PASS"
            : "FAIL"
        }`
      );

      console.error(
        `  Ran: ${
          test.ranPassed
            ? "PASS"
            : "FAIL"
        }`
      );
    }
  }

  cleanup();

  process.exit(1);
}

/* ================================== */
/* SUCCESS */
/* ================================== */

console.log(`
✅ ALL TESTS PASSED

Batch #${firstNumber} through #${lastNumber}
${specs.length}/${specs.length} detectors verified successfully.
`);

cleanup();

process.exit(0);
