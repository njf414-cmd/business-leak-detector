import {
    getIntegrationConnector,
  } from "./registry";
  
  import {
    normalizeIntegrationBatch,
    type ProviderFieldMap,
  } from "./normalizer";
  
  import {
    universalRecordToLeakEngineRow,
    type UniversalIntegrationRecord,
  } from "./universal-record";
  
  import type {
    IntegrationDataType,
    IntegrationProvider,
    RawIntegrationRecord,
  } from "./types";
  
  /* ================================== */
  /* TYPES */
  /* ================================== */
  
  export type IntegrationPipelineRequest = {
    provider: IntegrationProvider;
  
    dataTypes: IntegrationDataType[];
  
    fieldMap: ProviderFieldMap;
  };
  
  export type IntegrationPipelineResult = {
    success: boolean;
  
    provider: IntegrationProvider;
  
    rawRecords: RawIntegrationRecord[];
  
    universalRecords: UniversalIntegrationRecord[];
  
    leakEngineRows: ReturnType<
      typeof universalRecordToLeakEngineRow
    >[];
  
    stats: {
      received: number;
      normalized: number;
      rejected: number;
      warnings: number;
    };
  
    warnings: {
      field: string | null;
      message: string;
    }[];
  
    errors: string[];
  };
  
  /* ================================== */
  /* RUN PIPELINE */
  /* ================================== */
  
  export async function runIntegrationPipeline(
    request: IntegrationPipelineRequest
  ): Promise<IntegrationPipelineResult> {
    const {
      provider,
      dataTypes,
      fieldMap,
    } = request;
  
    const errors: string[] = [];
  
    /* ---------------------------------- */
    /* FIND CONNECTOR */
    /* ---------------------------------- */
  
    let connector;
  
    try {
      connector = getIntegrationConnector(provider);
    } catch (error) {
      return {
        success: false,
  
        provider,
  
        rawRecords: [],
        universalRecords: [],
        leakEngineRows: [],
  
        stats: {
          received: 0,
          normalized: 0,
          rejected: 0,
          warnings: 0,
        },
  
        warnings: [],
  
        errors: [
          error instanceof Error
            ? error.message
            : "Integration connector could not be loaded.",
        ],
      };
    }
  
    /* ---------------------------------- */
    /* TEST CONNECTION */
    /* ---------------------------------- */
  
    try {
      const connected =
        await connector.testConnection();
  
      if (!connected) {
        return {
          success: false,
  
          provider,
  
          rawRecords: [],
          universalRecords: [],
          leakEngineRows: [],
  
          stats: {
            received: 0,
            normalized: 0,
            rejected: 0,
            warnings: 0,
          },
  
          warnings: [],
  
          errors: [
            `The ${provider} connection test failed.`,
          ],
        };
      }
    } catch (error) {
      return {
        success: false,
  
        provider,
  
        rawRecords: [],
        universalRecords: [],
        leakEngineRows: [],
  
        stats: {
          received: 0,
          normalized: 0,
          rejected: 0,
          warnings: 0,
        },
  
        warnings: [],
  
        errors: [
          error instanceof Error
            ? error.message
            : `The ${provider} connection test failed.`,
        ],
      };
    }
  
    /* ---------------------------------- */
    /* FETCH RAW RECORDS */
    /* ---------------------------------- */
  
    let rawRecords: RawIntegrationRecord[] = [];
  
    try {
      rawRecords =
        await connector.fetchRecords(dataTypes);
    } catch (error) {
      return {
        success: false,
  
        provider,
  
        rawRecords: [],
        universalRecords: [],
        leakEngineRows: [],
  
        stats: {
          received: 0,
          normalized: 0,
          rejected: 0,
          warnings: 0,
        },
  
        warnings: [],
  
        errors: [
          error instanceof Error
            ? error.message
            : `Failed to fetch records from ${provider}.`,
        ],
      };
    }
  
    /* ---------------------------------- */
    /* NORMALIZE */
    /* ---------------------------------- */
  
    const normalized =
      normalizeIntegrationBatch(
        rawRecords,
        fieldMap
      );
  
    /* ---------------------------------- */
    /* CREATE LEAK ENGINE ROWS */
    /* ---------------------------------- */
  
    const leakEngineRows =
      normalized.records.map(
        universalRecordToLeakEngineRow
      );
  
    /* ---------------------------------- */
    /* VALIDATE RESULT */
    /* ---------------------------------- */
  
    if (
      rawRecords.length > 0 &&
      normalized.records.length === 0
    ) {
      errors.push(
        "Records were received, but none could be normalized."
      );
    }
  
    /* ---------------------------------- */
    /* RETURN */
    /* ---------------------------------- */
  
    return {
      success: errors.length === 0,
  
      provider,
  
      /*
        Raw records are preserved intentionally.
  
        AI Discovery and future industry-specific
        detectors may need information that is not
        part of today's normalized schema.
      */
  
      rawRecords,
  
      universalRecords:
        normalized.records,
  
      leakEngineRows,
  
      stats: {
        received:
          normalized.totalReceived,
  
        normalized:
          normalized.totalNormalized,
  
        rejected:
          normalized.totalRejected,
  
        warnings:
          normalized.warnings.length,
      },
  
      warnings:
        normalized.warnings,
  
      errors,
    };
  }