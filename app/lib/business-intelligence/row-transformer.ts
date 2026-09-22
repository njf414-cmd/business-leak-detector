import type {
  FieldMatch,
} from "./field-mapper";

export type RawCsvRow =
  Record<
    string,
    string
  >;

export type CanonicalRow =
  Record<
    string,
    string
  >;

export function transformRow(
  row: RawCsvRow,
  matches: FieldMatch[]
): CanonicalRow {
  const transformed:
    CanonicalRow = {};

  for (const match of matches) {
    const value =
      row[
        match.sourceField
      ];

    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    transformed[
      match.targetField
    ] =
      String(value).trim();
  }

  return transformed;
}

export function transformRows(
  rows: RawCsvRow[],
  matches: FieldMatch[]
): CanonicalRow[] {
  return rows.map(
    (row) =>
      transformRow(
        row,
        matches
      )
  );
}
