import { NextResponse } from "next/server";

import {
  getDetectorCatalog,
} from "../../lib/business-intelligence/detector-catalog";

import {
  mapFields,
} from "../../lib/business-intelligence/field-mapper";

import {
  transformRows,
} from "../../lib/business-intelligence/row-transformer";

type CsvRow =
  Record<string, string>;

function unique(
  values: string[]
) {
  return [
    ...new Set(values),
  ];
}

function parseCsv(
  csvText: string
): {
  headers: string[];
  rows: CsvRow[];
  skippedRows: number;
} {
  const records:
    string[][] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (
    let i = 0;
    i < csvText.length;
    i += 1
  ) {
    const char =
      csvText[i];

    const next =
      csvText[i + 1];

    if (char === '"') {
      if (
        inQuotes &&
        next === '"'
      ) {
        field += '"';
        i += 1;
        continue;
      }

      inQuotes =
        !inQuotes;

      continue;
    }

    if (
      char === "," &&
      !inQuotes
    ) {
      row.push(
        field.trim()
      );

      field = "";

      continue;
    }

    if (
      (
        char === "\n" ||
        char === "\r"
      ) &&
      !inQuotes
    ) {
      if (
        char === "\r" &&
        next === "\n"
      ) {
        i += 1;
      }

      row.push(
        field.trim()
      );

      field = "";

      const hasContent =
        row.some(
          (value) =>
            value.length > 0
        );

      if (hasContent) {
        records.push(
          row
        );
      }

      row = [];

      continue;
    }

    field += char;
  }

  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(
      field.trim()
    );

    const hasContent =
      row.some(
        (value) =>
          value.length > 0
      );

    if (hasContent) {
      records.push(
        row
      );
    }
  }

  if (
    records.length === 0
  ) {
    return {
      headers: [],
      rows: [],
      skippedRows: 0,
    };
  }

  const headers =
    records[0]
      .map(
        (header) =>
          header.trim()
      );

  const rows: CsvRow[] = [];

  let skippedRows = 0;

  for (
    const values
    of records.slice(1)
  ) {
    const hasContent =
      values.some(
        (value) =>
          value.trim().length > 0
      );

    if (!hasContent) {
      skippedRows += 1;
      continue;
    }

    const rowObject:
      CsvRow = {};

    for (
      let i = 0;
      i < headers.length;
      i += 1
    ) {
      const header =
        headers[i];

      if (!header) {
        continue;
      }

      rowObject[header] =
        values[i] ??
        "";
    }

    rows.push(
      rowObject
    );
  }

  return {
    headers,
    rows,
    skippedRows,
  };
}

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Missing CSV file. Use form field "file".',
        },
        {
          status: 400,
        }
      );
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Only CSV files are supported right now.",
        },
        {
          status: 400,
        }
      );
    }

    const csvText =
      await file.text();

    if (
      !csvText.trim()
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "CSV file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    const parsed =
      parseCsv(
        csvText
      );

    if (
      parsed.headers.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No CSV headers were found.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      parsed.rows.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "CSV has headers but no data rows.",
        },
        {
          status: 400,
        }
      );
    }

    const catalog =
      getDetectorCatalog();

    const targetFields =
      unique(
        catalog.flatMap(
          (detector) => [
            ...(
              detector.requirements
                .requiredFields ??
              []
            ),

            ...(
              detector.requirements
                .optionalFields ??
              []
            ),
          ]
        )
      ).sort();

    const mapping =
      mapFields(
        parsed.headers,
        targetFields,
        0.55
      );

    const transformedRows =
      transformRows(
        parsed.rows,
        mapping.matches
      );

    const mappedTargets =
      new Set(
        mapping.matches.map(
          (match) =>
            match.targetField
        )
      );

    const detectorReadiness =
      catalog.map(
        (detector) => {
          const required =
            detector.requirements
              .requiredFields ??
            [];

          const optional =
            detector.requirements
              .optionalFields ??
            [];

          const matchedRequired =
            required.filter(
              (field) =>
                mappedTargets.has(
                  field
                )
            );

          const missingRequired =
            required.filter(
              (field) =>
                !mappedTargets.has(
                  field
                )
            );

          const matchedOptional =
            optional.filter(
              (field) =>
                mappedTargets.has(
                  field
                )
            );

          const requiredCoverage =
            required.length === 0
              ? 1
              : matchedRequired.length /
                required.length;

          const ready =
            missingRequired.length ===
            0;

          const partiallySupported =
            !ready &&
            matchedRequired.length >
              0;

          return {
            detectorId:
              detector.id,

            name:
              detector.name,

            scope:
              detector.scope,

            industries:
              detector.industries,

            ready,

            partiallySupported,

            requiredFields:
              required,

            matchedRequiredFields:
              matchedRequired,

            missingRequiredFields:
              missingRequired,

            matchedOptionalFields:
              matchedOptional,

            requiredCoverage:
              Number(
                requiredCoverage.toFixed(
                  3
                )
              ),
          };
        }
      );

    const runnable =
      detectorReadiness.filter(
        (detector) =>
          detector.ready
      );

    const partial =
      detectorReadiness.filter(
        (detector) =>
          detector
            .partiallySupported
      );

    const unavailable =
      detectorReadiness.filter(
        (detector) =>
          !detector.ready &&
          !detector
            .partiallySupported
      );

    const runnableWithRequirements =
      runnable.filter(
        (detector) =>
          detector
            .requiredFields
            .length > 0
      );

    const noRequiredFields =
      runnable.filter(
        (detector) =>
          detector
            .requiredFields
            .length === 0
      );

    const highConfidence =
      mapping.matches.filter(
        (match) =>
          match.confidence >=
          0.9
      );

    const mediumConfidence =
      mapping.matches.filter(
        (match) =>
          match.confidence >=
            0.7 &&
          match.confidence <
            0.9
      );

    const lowConfidence =
      mapping.matches.filter(
        (match) =>
          match.confidence <
          0.7
      );

    const topRunnable =
      runnableWithRequirements
        .sort(
          (a, b) =>
            b.matchedOptionalFields
              .length -
            a.matchedOptionalFields
              .length
        )
        .slice(
          0,
          25
        );

    const closestPartial =
      partial
        .sort(
          (a, b) =>
            b.requiredCoverage -
            a.requiredCoverage
        )
        .slice(
          0,
          25
        );

    const transformedPreview =
      transformedRows.slice(
        0,
        5
      );

    return NextResponse.json({
      success: true,

      file: {
        name:
          file.name,

        size:
          file.size,

        type:
          file.type,
      },

      csv: {
        sourceFieldCount:
          parsed.headers.length,

        sourceFields:
          parsed.headers,

        rowCount:
          parsed.rows.length,

        skippedRows:
          parsed.skippedRows,
      },

      mapping: {
        mappedCount:
          mapping.matches.length,

        sourceFieldCount:
          parsed.headers.length,

        coverage:
          Number(
            (
              mapping.matches.length /
              parsed.headers.length
            ).toFixed(3)
          ),

        matches:
          mapping.matches,

        unmappedSourceFields:
          mapping
            .unmappedSourceFields,
      },

      confidence: {
        high:
          highConfidence.length,

        medium:
          mediumConfidence.length,

        low:
          lowConfidence.length,
      },

      transformation: {
        inputRows:
          parsed.rows.length,

        outputRows:
          transformedRows.length,

        preview:
          transformedPreview,
      },

      detectors: {
        total:
          detectorReadiness.length,

        runnable:
          runnable.length,

        runnableWithRequirements:
          runnableWithRequirements.length,

        noRequiredFields:
          noRequiredFields.length,

        partiallySupported:
          partial.length,

        unavailable:
          unavailable.length,

        topRunnable,

        closestPartial,
      },

      readyForAnalysis:
        runnable.length > 0 &&
        transformedRows.length >
          0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown CSV mapping error.",
      },
      {
        status: 500,
      }
    );
  }
}
