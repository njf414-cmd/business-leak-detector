import { CSV_CONTEXT_FIELDS, normalizeCsvRows } from "../../lib/business-intelligence/csv-normalizer";
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

import {
  evaluateDataQuality,
  validateBusinessData,
} from "../../lib/business-intelligence/data-quality";

import {
  runBusinessDetectors,
} from "../../lib/business-intelligence/detector-runner";

import {
  buildBusinessProfileFromData,
  classifyBusinessIndustry,
} from "../../lib/business-intelligence/industry-classifier";

import type {
  BusinessIndustry,
} from "../../lib/business-intelligence/types";

import type {
  BusinessDataRow,
} from "../../lib/business-intelligence/detector-types";

/* ================================== */
/* TYPES */
/* ================================== */

type CsvRow =
  Record<string, string>;

/* ================================== */
/* HELPERS */
/* ================================== */

function unique(
  values: string[]
): string[] {
  return [
    ...new Set(values),
  ];
}

function isIndustry(
  value: string
): value is BusinessIndustry {
  const industries:
    BusinessIndustry[] = [
      "subscription-services",
      "appointment-services",
      "home_services",
      "construction",
      "automotive",
      "restaurant",
      "retail",
      "ecommerce",
      "agency",
      "professional_services",
      "real_estate",
      "health_fitness",
      "healthcare",
      "beauty",
      "hospitality",
      "software",
      "education",
      "other",
    ];

  return industries.includes(
    value as BusinessIndustry
  );
}

/* ================================== */
/* CSV PARSER */
/* ================================== */

function parseCsv(csvText: string): {
  headers: string[];
  rows: CsvRow[];
  skippedRows: number;
} {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let skippedRows = 0;
  const finishRow = () => {
    row.push(field.trim());
    if (row.some((value) => value.length > 0)) records.push(row);
    else skippedRows += 1;
    row = [];
    field = "";
    closedQuote = false;
  };
  // Strip the BOM before checking whether the first field begins with a quote.
  const text = csvText.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
    } else if (char === ',') {
      row.push(field.trim()); field = ""; closedQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      finishRow();
    } else if (char === '"') {
      if (field.trim() || closedQuote) throw new Error("Unexpected quote in CSV field.");
      field = ""; quoted = true;
    } else {
      if (closedQuote && char.trim()) throw new Error("Unexpected text after closing CSV quote.");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field.length || row.length || closedQuote) finishRow();
  if (!records.length) return { headers: [], rows: [], skippedRows };
  const headers = records[0];
  if (headers.some((header) => !header)) throw new Error("CSV contains an empty column header.");
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new Error("CSV contains duplicate column headers.");
  }
  const rows = records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV record ${index + 2} has ${values.length} values; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
  return { headers, rows, skippedRows };
}

/* ================================== */
/* ROUTE */
/* ================================== */

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    /* ================================== */
    /* FILE VALIDATION */
    /* ================================== */

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
            "Only CSV files are supported.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Temporary safety limit.

      We can raise this later if needed.
    */

    const MAX_FILE_SIZE =
      10 * 1024 * 1024;

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CSV file is too large. Maximum size is 10 MB.",
        },
        {
          status: 413,
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

    /* ================================== */
    /* PARSE CSV */
    /* ================================== */

    let parsed: ReturnType<typeof parseCsv>;
    try {
      parsed = parseCsv(csvText);
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid CSV." }, { status: 400 });
    }

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
            "CSV contains headers but no data rows.",
        },
        {
          status: 400,
        }
      );
    }

    /* ================================== */
    /* DETECTOR CATALOG */
    /* ================================== */

    const catalog =
      getDetectorCatalog();

    const targetFields =
      unique(
        [...CSV_CONTEXT_FIELDS, ...catalog.flatMap(
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
        )]
      );

    /* ================================== */
    /* FIELD MAPPING */
    /* ================================== */

    const mapping =
      mapFields(
        parsed.headers,
        targetFields,
        0.55
      );

    const overridesValue = formData.get("mappingOverrides");
    if (overridesValue !== null) {
      let overrides: Record<string, string>;
      try {
        const value = JSON.parse(String(overridesValue));
        if (!value || typeof value !== "object" || Array.isArray(value) ||
            Object.entries(value).some(([source, target]) => !parsed.headers.includes(source) || typeof target !== "string" || (target !== "" && !targetFields.includes(target)))) {
          throw new Error("Invalid column selection.");
        }
        overrides = value;
      } catch {
        return NextResponse.json({ success: false, error: "Invalid mapping selections. Refresh the file preview and try again." }, { status: 400 });
      }
      const matches = mapping.matches.filter((match) => !Object.hasOwn(overrides, match.sourceField));
      for (const [sourceField, targetField] of Object.entries(overrides)) {
        if (targetField) matches.push({ sourceField, targetField, confidence: 1, reason: "User-reviewed mapping" });
      }
      if (new Set(matches.map((match) => match.targetField)).size !== matches.length) {
        return NextResponse.json({ success: false, error: "Two columns map to the same field. Select a different field or skip one column." }, { status: 400 });
      }
      mapping.matches = matches;
      mapping.unmappedSourceFields = parsed.headers.filter((field) => !matches.some((match) => match.sourceField === field));
    }

    /*
      Preliminary transformation allows
      mapping-quality inspection.
    */

    const preliminaryRows =
      transformRows(
        parsed.rows,
        mapping.matches
      );

    const mappingQuality =
      evaluateDataQuality(
        preliminaryRows,
        mapping.matches,
        0.7
      );

    /*
      Only trusted mappings enter the
      canonical detector dataset.
    */

    const mappedRows =
      transformRows(
        parsed.rows,
        mappingQuality
          .trustedMappings
      );

    const normalization = normalizeCsvRows(mappedRows);
    const transformedRows = normalization.rows;

    /* ================================== */
    /* ROW DATA QUALITY */
    /* ================================== */

    const analysisNow =
      new Date();

    const dataQuality =
      validateBusinessData(
        transformedRows,
        analysisNow
      );

    const blockedRowIndexes =
      new Set(
        dataQuality.issues
          .filter(
            (issue) =>
              issue.severity ===
                "error" &&
              issue.rowIndex !==
                null
          )
          .map(
            (issue) =>
              issue.rowIndex as number
          )
      );

    const detectorRows:
      BusinessDataRow[] =
      transformedRows.filter(
        (
          _row,
          rowIndex
        ) =>
          !blockedRowIndexes.has(
            rowIndex
          )
      );

    // Detectors receive a compacted valid-row array. Keep evidence indexed to
    // the uploaded records so blocking earlier rows cannot point at the wrong customer.
    const uploadedRowIndexes = transformedRows.map((_, index) => index)
      .filter((index) => !blockedRowIndexes.has(index));

    /* ================================== */
    /* BUSINESS CONTEXT */
    /* ================================== */

    const businessNameValue =
      formData.get(
        "businessName"
      );

    const descriptionValue =
      formData.get(
        "description"
      );

    const businessName =
      typeof businessNameValue ===
        "string" &&
      businessNameValue.trim()
        ? businessNameValue.trim()
        : null;

    const description =
      typeof descriptionValue ===
        "string" &&
      descriptionValue.trim()
        ? descriptionValue.trim()
        : null;

    /* ================================== */
    /* AUTOMATIC INDUSTRY CLASSIFICATION */
    /* ================================== */

    const classification =
      classifyBusinessIndustry({
        rows:
          detectorRows,
        businessName,
        description,
      });

    const profile =
      buildBusinessProfileFromData({
        rows:
          detectorRows,
        businessName,
        description,
      });

    /*
      Manual industry always overrides
      automatic classification.
    */

    const industryValue =
      formData.get(
        "industry"
      );

    let industrySelection:
      "automatic" |
      "manual" =
        "automatic";

    if (
      typeof industryValue ===
        "string" &&
      isIndustry(
        industryValue
      )
    ) {
      profile.industry =
        industryValue;

      industrySelection =
        "manual";
    }

    /* ================================== */
    /* PROFILE-AWARE DETECTOR SET */
    /* ================================== */

    const supportedDetectors =
      catalog.filter(
        (detector) => {
          const scopeSupported =
            detector.scope ===
              "universal" ||
            detector.industries.includes(
              profile.industry
            );

          if (!scopeSupported) {
            return false;
          }

          try {
            return detector.supports(
              profile
            );
          } catch {
            return false;
          }
        }
      );

    /*
      Readiness now uses only trusted
      canonical fields and only detectors
      relevant to this business profile.
    */

    const mappedTargets = new Set(detectorRows.flatMap((row) => Object.keys(row)));

    const detectorReadiness =
      supportedDetectors.map(
        (detector) => {
          const required =
            detector.requirements
              .requiredFields ??
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

          const requiredCoverage =
            required.length === 0
              ? 1
              : matchedRequired.length /
                required.length;

          return {
            detectorId:
              detector.id,

            name:
              detector.name,

            scope:
              detector.scope,

            industries:
              detector.industries,

            ready:
              missingRequired.length ===
              0,

            partiallySupported:
              matchedRequired.length > 0 &&
              missingRequired.length > 0,

            requiredFields:
              required,

            matchedRequiredFields:
              matchedRequired,

            missingRequiredFields:
              missingRequired,

            requiredCoverage:
              Number(
                requiredCoverage.toFixed(
                  3
                )
              ),
          };
        }
      );

    const runnableDetectors =
      detectorReadiness.filter(
        (detector) =>
          detector.ready
      );

    const runnableWithRequirements =
      runnableDetectors.filter(
        (detector) =>
          detector
            .requiredFields
            .length > 0
      );

    const noRequiredFields =
      runnableDetectors.filter(
        (detector) =>
          detector
            .requiredFields
            .length === 0
      );

    const partiallySupported =
      detectorReadiness.filter(
        (detector) =>
          detector
            .partiallySupported
      );

    const unavailableDetectors =
      detectorReadiness.filter(
        (detector) =>
          !detector.ready &&
          !detector
            .partiallySupported
      );

    /* ================================== */
    /* ANALYSIS */
    /* ================================== */

    const previewOnly = formData.get("mode") === "preview";
    const analysisPerformed = !previewOnly && detectorRows.length > 0;

    const result =
      analysisPerformed
        ? await runBusinessDetectors({
            profile,
            rows:
              detectorRows,
            now:
              analysisNow,
          })
        : {
            success: true,

            leaks: [],

            detectorResults:
              [],

            executionSummary:
              [],

            stats: {
              rowsAnalyzed: 0,

              detectorsSelected:
                0,

              detectorsRan:
                0,

              detectorsFailed:
                0,

              leaksFound:
                0,

              totalEstimatedLoss:
                0,

              totalEstimatedRecovery:
                0,

              warnings:
                0,

              errors:
                0,
            },

            warnings:
              [],

            errors:
              [],
          };

    /* ================================== */
    /* QUALITY SUMMARY */
    /* ================================== */

    const criticalIssues =
      dataQuality.issues.filter(
        (issue) =>
          issue.severity ===
          "error"
      ).length;

    const warningIssues =
      dataQuality.issues.filter(
        (issue) =>
          issue.severity ===
          "warning"
      ).length;

    const mappingConfidenceIssues =
      mappingQuality.issues.filter(
        (issue) =>
          issue.type ===
          "low-confidence-mapping"
      ).length;

    /* ================================== */
    /* RESPONSE */
    /* ================================== */

    return NextResponse.json({
      success:
        result.success,

      file: {
        name:
          file.name,

        size:
          file.size,

        rowCount:
          parsed.rows.length,

        rowsAccepted:
          detectorRows.length,

        rowsBlocked:
          blockedRowIndexes.size,

        skippedRows:
          parsed.skippedRows,
      },

      classification: {
        detectedIndustry:
          classification.industry,

        effectiveIndustry:
          profile.industry,

        selectionMode:
          industrySelection,

        confidence:
          classification.confidence,

        score:
          classification.score,

        reasons:
          classification.reasons,

        industryScores:
          classification
            .industryScores,
      },

      profile: {
        businessName:
          profile.businessName,

        description:
          profile.description,

        industry:
          profile.industry,

        businessModel:
          profile.businessModel,

        revenueModels:
          profile.revenueModels,

        capabilities:
          profile.capabilities,
      },

      previewOnly,

      mapping: {
        availableTargets: targetFields,
        sourceFieldCount:
          parsed.headers.length,

        sourceFields:
          parsed.headers,

        candidateMappings:
          mapping.matches.length,

        trustedMappings:
          mappingQuality
            .trustedMappings.length,

        rejectedMappings:
          mapping.matches.length -
          mappingQuality
            .trustedMappings.length,

        coverage:
          Number(
            (
              mappingQuality
                .trustedMappings.length /
              parsed.headers.length
            ).toFixed(3)
          ),

        matches:
          mappingQuality
            .trustedMappings,

        rejectedMatches:
          mapping.matches.filter(
            (match) =>
              match.confidence <
              0.7
          ),

        unmappedSourceFields:
          mapping
            .unmappedSourceFields,
      },

      normalization: { derivations: normalization.derivations, issues: normalization.issues },

      dataQuality: {
        valid:
          dataQuality.valid,

        score:
          dataQuality.score,

        summary: {
          rowsUploaded:
            parsed.rows.length,

          rowsAccepted:
            detectorRows.length,

          rowsBlocked:
            blockedRowIndexes.size,

          criticalIssues,

          warningIssues,

          mappingConfidenceIssues,

          analysisPerformed,
        },

        errors:
          dataQuality.errors,

        warnings:
          dataQuality.warnings,

        issues:
          dataQuality.issues,

        mappingIssues:
          mappingQuality.issues,

        mappingStats:
          mappingQuality.stats,
      },

      detectorReadiness: {
        catalogTotal:
          catalog.length,

        profileSupported:
          supportedDetectors.length,

        runnableFromFields:
          runnableDetectors.length,

        runnableWithRequirements:
          runnableWithRequirements.length,

        noRequiredFields:
          noRequiredFields.length,

        partiallySupported:
          partiallySupported.length,

        unavailable:
          unavailableDetectors.length,

        readyDetectorIds:
          runnableDetectors
            .map(
              (detector) =>
                detector.detectorId
            ),

        partialDetectors:
          partiallySupported
            .slice(
              0,
              25
            ),
      },

      analysis: {
        performed:
          analysisPerformed,

        stats:
          result.stats,

        leakCount:
          result.leaks.length,

        totalEstimatedLoss:
          result.stats
            .totalEstimatedLoss,

        totalEstimatedRecovery:
          result.stats
            .totalEstimatedRecovery,

        leaks:
          result.leaks.map((leak) => ({
            ...leak,
            sourceRowIndex: leak.sourceRowIndex === null
              ? null
              : uploadedRowIndexes[leak.sourceRowIndex] ?? null,
          })),

        warnings:
          result.warnings,

        errors:
          result.errors,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown CSV analysis error.",
      },
      {
        status: 500,
      }
    );
  }
}
