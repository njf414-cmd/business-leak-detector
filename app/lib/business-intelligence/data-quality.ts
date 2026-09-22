import type {
  FieldMatch,
} from "./field-mapper";

import type {
  BusinessDataRow,
} from "./detector-types";

/* ================================== */
/* ISSUE TYPES */
/* ================================== */

export type DataIssueType =
  | "unknown-customer"
  | "invalid-money"
  | "invalid-date"
  | "future-date"
  | "conflicting-status"
  | "duplicate-record"
  | "low-confidence-mapping"
  | "empty-data";

export type DataIssueSeverity =
  | "info"
  | "warning"
  | "error";

export type DataQualityIssue = {
  type: DataIssueType;

  severity:
    DataIssueSeverity;

  rowIndex:
    number | null;

  field:
    string | null;

  message:
    string;
};

/* ================================== */
/* EXISTING VALIDATOR RESULT */
/* ================================== */

export type DataQualityResult = {
  valid: boolean;

  score: number;

  rowsAnalyzed: number;

  rowsWithIssues: number;

  totalIssues: number;

  errors: number;

  warnings: number;

  info: number;

  issues:
    DataQualityIssue[];
};

/* ================================== */
/* NEW MAPPING QUALITY RESULT */
/* ================================== */

export type MappingDataQualityResult = {
  valid: boolean;

  issues:
    DataQualityIssue[];

  stats: {
    rows: number;

    fieldsSeen: number;

    emptyValues: number;

    invalidNumbers: number;

    invalidDates: number;

    lowConfidenceMappings: number;
  };

  trustedMappings:
    FieldMatch[];
};

/* ================================== */
/* FIELD HELPERS */
/* ================================== */

const MONEY_HINTS = [
  "amount",
  "price",
  "revenue",
  "cost",
  "fee",
  "balance",
  "profit",
  "credit",
  "deposit",
  "charge",
  "markup",
  "rate",
];

const DATE_HINTS = [
  "date",
  "due",
  "renewal",
  "expiration",
  "start",
  "end",
];

function normalize(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function isEmpty(
  value: unknown
): boolean {
  return (
    value === undefined ||
    value === null ||
    normalize(value) === ""
  );
}

/* ================================== */
/* MONEY */
/* ================================== */

function looksLikeMoneyField(
  field: string
): boolean {
  const name =
    normalize(field);

  if (
    name.includes("status") ||
    name.includes("date") ||
    name.includes("method")
  ) {
    return false;
  }

  return MONEY_HINTS.some(
    (hint) =>
      name.includes(hint)
  );
}

function parseMoney(
  value: unknown
): number | null {
  if (
    typeof value ===
      "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .replace(/\$/g, "")
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();

  if (!cleaned) {
    return null;
  }

  const parsed =
    Number(cleaned);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

/* ================================== */
/* DATES */
/* ================================== */

function looksLikeDateField(
  field: string
): boolean {
  const name =
    normalize(field);

  // "end" inside "Recommended" is not a date, and status fields contain labels.
  const words = name.split(/[^a-z0-9]+/);
  if (words.includes("status")) return false;
  return DATE_HINTS.some((hint) => words.includes(hint));
}

function parseDate(
  value: unknown
): Date | null {
  if (
    value instanceof Date
  ) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const date =
    new Date(trimmed);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function isFutureAllowedField(
  field: string
): boolean {
  const name =
    normalize(field);

  return (
    name.includes("due") ||
    name.includes("renewal") ||
    name.includes("expiration") ||
    name.includes("expiry") ||
    name.includes("next ") ||
    name.startsWith("next ")
  );
}

/* ================================== */
/* CUSTOMER */
/* ================================== */

function getCustomerValue(
  row: BusinessDataRow
): unknown {
  const candidates = [
    "Customer Name",
    "Customer",
    "Client Name",
    "Client",
    "Account Name",
    "Account",
    "Record",
  ];

  for (
    const field
    of candidates
  ) {
    if (
      field in row
    ) {
      return row[field];
    }
  }

  return undefined;
}

function rowHasCustomerField(
  row: BusinessDataRow
): boolean {
  return [
    "Customer Name",
    "Customer",
    "Client Name",
    "Client",
    "Account Name",
    "Account",
    "Record",
  ].some(
    (field) =>
      field in row
  );
}

/* ================================== */
/* STATUS */
/* ================================== */

function isPaidStatus(
  value: unknown
): boolean {
  const status =
    normalize(value);

  return [
    "paid",
    "complete",
    "completed",
    "collected",
    "settled",
  ].includes(status);
}

function isUnpaidStatus(
  value: unknown
): boolean {
  const status =
    normalize(value);

  return [
    "unpaid",
    "past due",
    "overdue",
    "outstanding",
    "open",
    "failed",
  ].includes(status);
}

/* ================================== */
/* DUPLICATES */
/* ================================== */

function stableRowKey(
  row: BusinessDataRow
): string {
  const entries =
    Object.entries(row)
      .sort(
        ([a], [b]) =>
          a.localeCompare(b)
      );

  return JSON.stringify(
    entries
  );
}

/* ================================== */
/* MAIN BUSINESS DATA VALIDATOR */
/* ================================== */

export function validateBusinessData(
  rows: BusinessDataRow[],
  now = new Date()
): DataQualityResult {
  const issues:
    DataQualityIssue[] = [];

  const seenRows =
    new Map<
      string,
      number
    >();

  rows.forEach(
    (
      row,
      rowIndex
    ) => {
      /* ------------------------------ */
      /* CUSTOMER */
      /* ------------------------------ */

      if (
        rowHasCustomerField(
          row
        )
      ) {
        const customer =
          getCustomerValue(
            row
          );

        if (
          isEmpty(customer)
        ) {
          issues.push({
            type:
              "unknown-customer",

            severity:
              "warning",

            rowIndex,

            field:
              "Customer Name",

            message:
              "Customer identity is missing.",
          });
        }
      }

      /* ------------------------------ */
      /* MONEY + DATE VALIDATION */
      /* ------------------------------ */

      for (
        const [
          field,
          value,
        ]
        of Object.entries(row)
      ) {
        if (
          isEmpty(value)
        ) {
          continue;
        }

        if (
          looksLikeMoneyField(
            field
          )
        ) {
          const money =
            parseMoney(
              value
            );

          if (
            money === null ||
            money < 0
          ) {
            issues.push({
              type:
                "invalid-money",

              severity:
                "error",

              rowIndex,

              field,

              message:
                `Invalid money value "${String(value)}" in "${field}".`,
            });
          }
        }

        if (
          looksLikeDateField(
            field
          )
        ) {
          const date =
            parseDate(
              value
            );

          if (!date) {
            issues.push({
              type:
                "invalid-date",

              severity:
                "error",

              rowIndex,

              field,

              message:
                `Invalid date value "${String(value)}" in "${field}".`,
            });

            continue;
          }

          if (
            date.getTime() >
              now.getTime() &&
            !isFutureAllowedField(
              field
            )
          ) {
            issues.push({
              type:
                "future-date",

              severity:
                "warning",

              rowIndex,

              field,

              message:
                `Historical field "${field}" contains a future date.`,
            });
          }
        }
      }

      /* ------------------------------ */
      /* STATUS CONFLICT */
      /* ------------------------------ */

      const status =
        row["Status"];

      const paymentStatus =
        row[
          "Payment Status"
        ];

      if (
        !isEmpty(status) &&
        !isEmpty(
          paymentStatus
        )
      ) {
        const conflict =
          (
            isPaidStatus(
              status
            ) &&
            isUnpaidStatus(
              paymentStatus
            )
          ) ||
          (
            isUnpaidStatus(
              status
            ) &&
            isPaidStatus(
              paymentStatus
            )
          );

        if (conflict) {
          issues.push({
            type:
              "conflicting-status",

            severity:
              "warning",

            rowIndex,

            field:
              "Payment Status",

            message:
              `Status "${String(status)}" conflicts with payment status "${String(paymentStatus)}".`,
          });
        }
      }

      /* ------------------------------ */
      /* DUPLICATE */
      /* ------------------------------ */

      const key =
        stableRowKey(
          row
        );

      if (
        seenRows.has(key)
      ) {
        issues.push({
          type:
            "duplicate-record",

          severity:
            "warning",

          rowIndex,

          field:
            null,

          message:
            `Duplicate record matches row ${seenRows.get(key)}.`,
        });
      } else {
        seenRows.set(
          key,
          rowIndex
        );
      }
    }
  );

  const errors =
    issues.filter(
      (issue) =>
        issue.severity ===
        "error"
    ).length;

  const warnings =
    issues.filter(
      (issue) =>
        issue.severity ===
        "warning"
    ).length;

  const info =
    issues.filter(
      (issue) =>
        issue.severity ===
        "info"
    ).length;

  const rowsWithIssues =
    new Set(
      issues
        .map(
          (issue) =>
            issue.rowIndex
        )
        .filter(
          (
            value
          ): value is number =>
            value !== null
        )
    ).size;

  const penalty =
    errors * 12 +
    warnings * 4 +
    info;

  const score =
    Math.max(
      0,
      Math.min(
        100,
        100 - penalty
      )
    );

  return {
    valid:
      errors === 0,

    score,

    rowsAnalyzed:
      rows.length,

    rowsWithIssues,

    totalIssues:
      issues.length,

    errors,

    warnings,

    info,

    issues,
  };
}

/* ================================== */
/* MAPPING / INGESTION QUALITY */
/* ================================== */

export function evaluateDataQuality(
  rows: BusinessDataRow[],
  mappings: FieldMatch[],
  minimumAutoConfidence = 0.7
): MappingDataQualityResult {
  const issues:
    DataQualityIssue[] = [];

  const trustedMappings =
    mappings.filter(
      (mapping) =>
        mapping.confidence >=
        minimumAutoConfidence
    );

  const rejectedMappings =
    mappings.filter(
      (mapping) =>
        mapping.confidence <
        minimumAutoConfidence
    );

  for (
    const mapping
    of rejectedMappings
  ) {
    issues.push({
      type:
        "low-confidence-mapping",

      severity:
        "warning",

      rowIndex:
        null,

      field:
        mapping.targetField,

      message:
        `Rejected low-confidence mapping "${mapping.sourceField}" -> "${mapping.targetField}" (${mapping.confidence}).`,
    });
  }

  let emptyValues = 0;
  let invalidNumbers = 0;
  let invalidDates = 0;

  const fieldsSeen =
    new Set<string>();

  rows.forEach(
    (
      row,
      rowIndex
    ) => {
      for (
        const [
          field,
          value,
        ]
        of Object.entries(row)
      ) {
        fieldsSeen.add(
          field
        );

        if (
          isEmpty(value)
        ) {
          emptyValues += 1;
          continue;
        }

        if (
          looksLikeMoneyField(
            field
          )
        ) {
          const parsed =
            parseMoney(
              value
            );

          if (
            parsed === null ||
            parsed < 0
          ) {
            invalidNumbers += 1;

            issues.push({
              type:
                "invalid-money",

              severity:
                "warning",

              rowIndex,

              field,

              message:
                `Untrusted numeric value "${String(value)}".`,
            });
          }
        }

        if (
          looksLikeDateField(
            field
          ) &&
          !parseDate(
            value
          )
        ) {
          invalidDates += 1;

          issues.push({
            type:
              "invalid-date",

            severity:
              "warning",

            rowIndex,

            field,

            message:
              `Untrusted date value "${String(value)}".`,
          });
        }
      }
    }
  );

  if (
    rows.length === 0
  ) {
    issues.push({
      type:
        "empty-data",

      severity:
        "error",

      rowIndex:
        null,

      field:
        null,

      message:
        "No usable rows were provided.",
    });
  }

  if (
    trustedMappings.length ===
    0
  ) {
    issues.push({
      type:
        "low-confidence-mapping",

      severity:
        "error",

      rowIndex:
        null,

      field:
        null,

      message:
        "No trustworthy field mappings were found.",
    });
  }

  return {
    valid:
      !issues.some(
        (issue) =>
          issue.severity ===
          "error"
      ),

    issues,

    stats: {
      rows:
        rows.length,

      fieldsSeen:
        fieldsSeen.size,

      emptyValues,

      invalidNumbers,

      invalidDates,

      lowConfidenceMappings:
        rejectedMappings.length,
    },

    trustedMappings,
  };
}
