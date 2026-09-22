import type {
    RawIntegrationRecord,
  } from "./types";
  
  import type {
    NormalizationBatchResult,
    NormalizationResult,
    UniversalIntegrationRecord,
    UniversalValue,
  } from "./universal-record";
  
  /* ================================== */
  /* PROVIDER FIELD MAP */
  /* ================================== */
  
  export type UniversalField =
    | "customerName"
    | "status"
    | "quoteAmount"
    | "invoiceAmount"
    | "amountPaid"
    | "jobAmount"
    | "recordDate"
    | "lastContactDate"
    | "dueDate"
    | "expirationDate"
    | "followUp"
    | "contacted"
    | "estimateSent"
    | "paymentStatus"
    | "appointmentStatus"
    | "jobStatus";
  
  export type ProviderFieldMap = Partial<
    Record<UniversalField, string>
  >;
  
  /* ================================== */
  /* HELPERS */
  /* ================================== */
  
  function getValue(
    data: Record<string, unknown>,
    sourceField: string | undefined
  ): unknown {
    if (!sourceField) {
      return null;
    }
  
    return data[sourceField] ?? null;
  }
  
  function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
  
    const result = String(value).trim();
  
    return result.length > 0 ? result : null;
  }
  
  function normalizeNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
  
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
  
    const cleaned = String(value)
      .trim()
      .replace(/[$,%\s]/g, "")
      .replace(/,/g, "");
  
    if (!cleaned) {
      return null;
    }
  
    const parsed = Number(cleaned);
  
    return Number.isFinite(parsed) ? parsed : null;
  }
  
  function normalizeDate(value: unknown): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
  
    const raw = String(value).trim();
  
    if (!raw) {
      return null;
    }
  
    const timestamp = Date.parse(raw);
  
    if (Number.isNaN(timestamp)) {
      return null;
    }
  
    return new Date(timestamp).toISOString();
  }
  
  function normalizeUniversalValue(
    value: unknown
  ): UniversalValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
  
    if (value === undefined) {
      return null;
    }
  
    return String(value);
  }
  
  /* ================================== */
  /* SINGLE RECORD NORMALIZATION */
  /* ================================== */
  
  export function normalizeIntegrationRecord(
    source: RawIntegrationRecord,
    fieldMap: ProviderFieldMap
  ): NormalizationResult {
    const warnings: NormalizationResult["warnings"] = [];
    const errors: string[] = [];
  
    if (!source.sourceRecordId) {
      errors.push("Source record is missing an ID.");
    }
  
    if (!source.data || typeof source.data !== "object") {
      errors.push("Source record contains invalid data.");
    }
  
    if (errors.length > 0) {
      return {
        success: false,
        record: null,
        warnings,
        errors,
      };
    }
  
    function numberField(
      universalField: UniversalField
    ): number | null {
      const sourceField = fieldMap[universalField];
      const raw = getValue(source.data, sourceField);
      const normalized = normalizeNumber(raw);
  
      if (
        sourceField &&
        raw !== null &&
        raw !== undefined &&
        raw !== "" &&
        normalized === null
      ) {
        warnings.push({
          field: universalField,
          message: `${sourceField} could not be safely converted to a number.`,
        });
      }
  
      return normalized;
    }
  
    function dateField(
      universalField: UniversalField
    ): string | null {
      const sourceField = fieldMap[universalField];
      const raw = getValue(source.data, sourceField);
      const normalized = normalizeDate(raw);
  
      if (
        sourceField &&
        raw !== null &&
        raw !== undefined &&
        raw !== "" &&
        normalized === null
      ) {
        warnings.push({
          field: universalField,
          message: `${sourceField} could not be safely converted to a date.`,
        });
      }
  
      return normalized;
    }
  
    const record: UniversalIntegrationRecord = {
      provider: source.provider,
      sourceRecordId: source.sourceRecordId,
      sourceDataType: source.dataType,
  
      customerName: normalizeString(
        getValue(source.data, fieldMap.customerName)
      ),
  
      status: normalizeString(
        getValue(source.data, fieldMap.status)
      ),
  
      quoteAmount: numberField("quoteAmount"),
      invoiceAmount: numberField("invoiceAmount"),
      amountPaid: numberField("amountPaid"),
      jobAmount: numberField("jobAmount"),
  
      recordDate: dateField("recordDate"),
      lastContactDate: dateField("lastContactDate"),
      dueDate: dateField("dueDate"),
      expirationDate: dateField("expirationDate"),
  
      followUp: normalizeUniversalValue(
        getValue(source.data, fieldMap.followUp)
      ),
  
      contacted: normalizeUniversalValue(
        getValue(source.data, fieldMap.contacted)
      ),
  
      estimateSent: normalizeUniversalValue(
        getValue(source.data, fieldMap.estimateSent)
      ),
  
      paymentStatus: normalizeString(
        getValue(source.data, fieldMap.paymentStatus)
      ),
  
      appointmentStatus: normalizeString(
        getValue(source.data, fieldMap.appointmentStatus)
      ),
  
      jobStatus: normalizeString(
        getValue(source.data, fieldMap.jobStatus)
      ),
  
      sourceUpdatedAt: source.sourceUpdatedAt,
  
      /*
        Never discard the provider's original record.
        Future detectors and AI Discovery may need fields that
        today's universal schema does not understand yet.
      */
  
      rawData: { ...source.data },
    };
  
    return {
      success: true,
      record,
      warnings,
      errors: [],
    };
  }
  
  /* ================================== */
  /* BATCH NORMALIZATION */
  /* ================================== */
  
  export function normalizeIntegrationBatch(
    records: RawIntegrationRecord[],
    fieldMap: ProviderFieldMap
  ): NormalizationBatchResult {
    const normalizedRecords: UniversalIntegrationRecord[] = [];
    const rejectedRecords: RawIntegrationRecord[] = [];
    const warnings: NormalizationBatchResult["warnings"] = [];
  
    for (const source of records) {
      const result = normalizeIntegrationRecord(
        source,
        fieldMap
      );
  
      warnings.push(...result.warnings);
  
      if (!result.success || !result.record) {
        rejectedRecords.push(source);
        continue;
      }
  
      normalizedRecords.push(result.record);
    }
  
    return {
      records: normalizedRecords,
      rejectedRecords,
      warnings,
  
      totalReceived: records.length,
      totalNormalized: normalizedRecords.length,
      totalRejected: rejectedRecords.length,
    };
  }