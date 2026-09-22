import { NextResponse } from "next/server";

import {
  validateBusinessData,
  type DataIssueType,
} from "../../lib/business-intelligence/data-quality";

import type {
  BusinessDataRow,
} from "../../lib/business-intelligence/detector-types";

/* ================================== */
/* FIXED TEST CLOCK */
/* ================================== */

const TEST_NOW = new Date(
  "2026-09-20T12:00:00"
);

/* ================================== */
/* TEST DATA */
/* ================================== */

const testRows: BusinessDataRow[] = [
  /*
    0 — Clean record.
    Should produce NO issues.
  */
  {
    "Customer Name": "Clean Customer",
    Status: "Paid",
    "Payment Status": "Paid",
    "Invoice Amount": "1200",
    "Amount Paid": "1200",
    Date: "2026-09-10",
  },

  /*
    1 — Missing customer.
  */
  {
    "Customer Name": "",
    Status: "Lead",
    "Quote Amount": "1500",
    Date: "2026-09-10",
  },

  /*
    2 — Invalid money.
  */
  {
    "Customer Name": "Bad Money Customer",
    Status: "Unpaid",
    "Invoice Amount": "twelve hundred",
    Date: "2026-09-10",
  },

  /*
    3 — Negative money.
  */
  {
    "Customer Name": "Negative Money Customer",
    Status: "Unpaid",
    "Invoice Amount": "-500",
    Date: "2026-09-10",
  },

  /*
    4 — Invalid date.
  */
  {
    "Customer Name": "Bad Date Customer",
    Status: "Lead",
    "Quote Amount": "900",
    Date: "2026-99-99",
  },

  /*
    5 — Historical date incorrectly
    in the future.
  */
  {
    "Customer Name": "Future Customer",
    Status: "Lead",
    "Quote Amount": "700",
    Date: "2027-01-01",
  },

  /*
    6 — Paid vs unpaid conflict.
  */
  {
    "Customer Name": "Conflict Customer A",
    Status: "Paid",
    "Payment Status": "Unpaid",
    "Invoice Amount": "1000",
    Date: "2026-09-01",
  },

  /*
    7 — Unpaid vs paid conflict.
  */
  {
    "Customer Name": "Conflict Customer B",
    Status: "Unpaid",
    "Payment Status": "Paid",
    "Invoice Amount": "1000",
    Date: "2026-09-01",
  },

  /*
    8 + 9 — Exact duplicate pair.
  */
  {
    "Customer Name": "Duplicate Customer",
    Status: "Lead",
    "Quote Amount": "2000",
    Date: "2026-09-05",
  },

  {
    "Customer Name": "Duplicate Customer",
    Status: "Lead",
    "Quote Amount": "2000",
    Date: "2026-09-05",
  },

  /*
    10 — Future due date.
    This is legitimate and must NOT
    be marked as a future-date issue.
  */
  {
    "Customer Name": "Future Due Customer",
    Status: "Unpaid",
    "Invoice Amount": "500",
    "Due Date": "2026-10-15",
    Date: "2026-09-15",
  },

  /*
    11 — Future renewal date.
    Also legitimate.
  */
  {
    "Customer Name": "Future Renewal Customer",
    Status: "Active",
    "Renewal Amount": "1500",
    "Renewal Date": "2027-01-01",
    "Renewal Status": "Pending",
    Date: "2026-09-01",
  },

  /*
    12 — Currency formatting.
    Should be accepted.
  */
  {
    "Customer Name": "Currency Customer",
    Status: "Paid",
    "Invoice Amount": "$1,250.50",
    "Amount Paid": "$1,250.50",
    Date: "09/10/2026",
  },

  /*
    13 — Several errors on one row.

    Tests that validation continues
    after finding the first error.
  */
  {
    "Customer Name": "Multi Error Customer",
    Status: "Unpaid",
    "Invoice Amount": "banana",
    "Job Amount": "-200",
    "Renewal Amount": "not money",
    Date: "not-a-date",
  },
];

/* ================================== */
/* EXPECTATIONS */
/* ================================== */

type Expectation = {
  name: string;
  rowIndex: number;
  type: DataIssueType;
  shouldExist: boolean;
};

const expectations: Expectation[] = [
  {
    name: "Missing customer detected",
    rowIndex: 1,
    type: "unknown-customer",
    shouldExist: true,
  },

  {
    name: "Invalid money detected",
    rowIndex: 2,
    type: "invalid-money",
    shouldExist: true,
  },

  {
    name: "Negative money detected",
    rowIndex: 3,
    type: "invalid-money",
    shouldExist: true,
  },

  {
    name: "Invalid date detected",
    rowIndex: 4,
    type: "invalid-date",
    shouldExist: true,
  },

  {
    name: "Future historical date detected",
    rowIndex: 5,
    type: "future-date",
    shouldExist: true,
  },

  {
    name: "Paid/unpaid conflict detected",
    rowIndex: 6,
    type: "conflicting-status",
    shouldExist: true,
  },

  {
    name: "Unpaid/paid conflict detected",
    rowIndex: 7,
    type: "conflicting-status",
    shouldExist: true,
  },

  {
    name: "Duplicate detected",
    rowIndex: 9,
    type: "duplicate-record",
    shouldExist: true,
  },

  {
    name: "Future due date allowed",
    rowIndex: 10,
    type: "future-date",
    shouldExist: false,
  },

  {
    name: "Future renewal date allowed",
    rowIndex: 11,
    type: "future-date",
    shouldExist: false,
  },

  {
    name: "Currency money accepted",
    rowIndex: 12,
    type: "invalid-money",
    shouldExist: false,
  },

  {
    name: "US date accepted",
    rowIndex: 12,
    type: "invalid-date",
    shouldExist: false,
  },

  {
    name: "Multi-error money detected",
    rowIndex: 13,
    type: "invalid-money",
    shouldExist: true,
  },

  {
    name: "Multi-error date detected",
    rowIndex: 13,
    type: "invalid-date",
    shouldExist: true,
  },
];

/* ================================== */
/* HELPERS */
/* ================================== */

function rowHasIssue(
  result: ReturnType<
    typeof validateBusinessData
  >,
  rowIndex: number,
  type: DataIssueType
): boolean {
  return result.issues.some(
    (issue) =>
      issue.rowIndex === rowIndex &&
      issue.type === type
  );
}

/* ================================== */
/* ROUTE */
/* ================================== */

export async function GET() {
  const result =
    validateBusinessData(
      testRows,
      TEST_NOW
    );

  /* ---------------------------------- */
  /* EXPECTATION TESTS */
  /* ---------------------------------- */

  const expectationResults =
    expectations.map(
      (expectation) => {
        const exists =
          rowHasIssue(
            result,
            expectation.rowIndex,
            expectation.type
          );

        const passed =
          expectation.shouldExist
            ? exists
            : !exists;

        return {
          ...expectation,
          exists,
          passed,
        };
      }
    );

  /* ---------------------------------- */
  /* CLEAN ROW SAFETY */
  /* ---------------------------------- */

  const cleanRowIssues =
    result.issues.filter(
      (issue) =>
        issue.rowIndex === 0
    );

  const cleanRowPassed =
    cleanRowIssues.length === 0;

  /* ---------------------------------- */
  /* MULTI-ERROR SAFETY */
  /* ---------------------------------- */

  const multiErrorIssues =
    result.issues.filter(
      (issue) =>
        issue.rowIndex === 13
    );

  const multiErrorTypes =
    new Set(
      multiErrorIssues.map(
        (issue) =>
          issue.type
      )
    );

  const multiErrorPassed =
    multiErrorTypes.has(
      "invalid-money"
    ) &&
    multiErrorTypes.has(
      "invalid-date"
    );

  /* ---------------------------------- */
  /* ERROR BEHAVIOR */
  /* ---------------------------------- */

  const errorBehaviorPassed =
    result.errors > 0 &&
    result.valid === false;

  /* ---------------------------------- */
  /* WARNING BEHAVIOR */
  /* ---------------------------------- */

  const warningOnlyRows = [
    1,
    5,
    6,
    7,
    9,
  ];

  const warningRowsPassed =
    warningOnlyRows.every(
      (rowIndex) =>
        result.issues.some(
          (issue) =>
            issue.rowIndex ===
              rowIndex &&
            issue.severity ===
              "warning"
        )
    );

  /* ---------------------------------- */
  /* SCORE SAFETY */
  /* ---------------------------------- */

  const scorePassed =
    result.score >= 0 &&
    result.score <= 100 &&
    result.score < 100;

  /* ---------------------------------- */
  /* CLEAN FUTURE DATE SAFETY */
  /* ---------------------------------- */

  const futureDueDatePassed =
    !rowHasIssue(
      result,
      10,
      "future-date"
    );

  const futureRenewalPassed =
    !rowHasIssue(
      result,
      11,
      "future-date"
    );

  /* ---------------------------------- */
  /* FORMATTING SAFETY */
  /* ---------------------------------- */

  const currencyPassed =
    !rowHasIssue(
      result,
      12,
      "invalid-money"
    );

  const usDatePassed =
    !rowHasIssue(
      result,
      12,
      "invalid-date"
    );

  /* ---------------------------------- */
  /* TOTAL RESULT */
  /* ---------------------------------- */

  const expectationsPassed =
    expectationResults.every(
      (expectation) =>
        expectation.passed
    );

  const allTestsPassed =
    expectationsPassed &&
    cleanRowPassed &&
    multiErrorPassed &&
    errorBehaviorPassed &&
    warningRowsPassed &&
    scorePassed &&
    futureDueDatePassed &&
    futureRenewalPassed &&
    currencyPassed &&
    usDatePassed;

  /* ================================== */
  /* RESPONSE */
  /* ================================== */

  return NextResponse.json({
    success:
      allTestsPassed,

    message:
      allTestsPassed
        ? "Data Quality torture test passed."
        : "Data Quality torture test failed.",

    testClock:
      TEST_NOW.toISOString(),

    summary: {
      rowsTested:
        testRows.length,

      expectations:
        expectationResults.length,

      expectationsPassed:
        expectationResults.filter(
          (expectation) =>
            expectation.passed
        ).length,

      expectationsFailed:
        expectationResults.filter(
          (expectation) =>
            !expectation.passed
        ).length,

      cleanRowPassed,

      multiErrorPassed,

      errorBehaviorPassed,

      warningRowsPassed,

      scorePassed,

      futureDueDatePassed,

      futureRenewalPassed,

      currencyPassed,

      usDatePassed,

      allTestsPassed,
    },

    validatorResult: {
      valid:
        result.valid,

      score:
        result.score,

      rowsAnalyzed:
        result.rowsAnalyzed,

      rowsWithIssues:
        result.rowsWithIssues,

      totalIssues:
        result.totalIssues,

      errors:
        result.errors,

      warnings:
        result.warnings,

      info:
        result.info,
    },

    expectationResults,

    issues:
      result.issues,
  });
}