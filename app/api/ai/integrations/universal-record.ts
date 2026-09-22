import type {
    IntegrationDataType,
    IntegrationProvider,
    RawIntegrationRecord,
  } from "./types";
  
  /* ================================== */
  /* UNIVERSAL VALUE TYPES */
  /* ================================== */
  
  export type UniversalValue =
    | string
    | number
    | boolean
    | null;
  
  /* ================================== */
  /* UNIVERSAL RECORD */
  /* ================================== */
  
  export type UniversalIntegrationRecord = {
    /* Source identity */
  
    provider: IntegrationProvider;
    sourceRecordId: string;
    sourceDataType: IntegrationDataType;
  
    /* Core business identity */
  
    customerName: string | null;
  
    /* General state */
  
    status: string | null;
  
    /* Money */
  
    quoteAmount: number | null;
    invoiceAmount: number | null;
    amountPaid: number | null;
    jobAmount: number | null;
  
    /* Dates */
  
    recordDate: string | null;
    lastContactDate: string | null;
    dueDate: string | null;
    expirationDate: string | null;
  
    /* Sales / communication */
  
    followUp: UniversalValue;
    contacted: UniversalValue;
    estimateSent: UniversalValue;
  
    /* Operational state */
  
    paymentStatus: string | null;
    appointmentStatus: string | null;
    jobStatus: string | null;
  
    /* Sync information */
  
    sourceUpdatedAt: string | null;
  
    /*
      Original provider data is intentionally preserved.
  
      This allows:
      - future AI Discovery
      - remapping
      - debugging
      - new leak detectors
      - industry-specific analysis
  
      without losing information during normalization.
    */
  
    rawData: Record<string, unknown>;
  };
  
  /* ================================== */
  /* NORMALIZATION RESULT */
  /* ================================== */
  
  export type NormalizationWarning = {
    field: string | null;
    message: string;
  };
  
  export type NormalizationResult = {
    success: boolean;
  
    record: UniversalIntegrationRecord | null;
  
    warnings: NormalizationWarning[];
  
    errors: string[];
  };
  
  /* ================================== */
  /* BATCH RESULT */
  /* ================================== */
  
  export type NormalizationBatchResult = {
    records: UniversalIntegrationRecord[];
  
    rejectedRecords: RawIntegrationRecord[];
  
    warnings: NormalizationWarning[];
  
    totalReceived: number;
    totalNormalized: number;
    totalRejected: number;
  };
  
  /* ================================== */
  /* LEAK ENGINE FIELD NAMES */
  /* ================================== */
  
  export const LEAK_ENGINE_FIELDS = [
    "Customer Name",
    "Status",
    "Quote Amount",
    "Invoice Amount",
    "Follow Up",
    "Date",
    "Last Contact Date",
    "Due Date",
    "Payment Status",
    "Contacted",
    "Estimate Sent",
    "Expiration Date",
    "Amount Paid",
    "Appointment Status",
    "Job Status",
    "Job Amount",
  ] as const;
  
  export type LeakEngineField =
    (typeof LEAK_ENGINE_FIELDS)[number];
  
  /* ================================== */
  /* UNIVERSAL → LEAK ENGINE */
  /* ================================== */
  
  export function universalRecordToLeakEngineRow(
    record: UniversalIntegrationRecord
  ): Record<LeakEngineField, UniversalValue> {
    return {
      "Customer Name": record.customerName,
  
      Status: record.status,
  
      "Quote Amount": record.quoteAmount,
      "Invoice Amount": record.invoiceAmount,
  
      "Follow Up": record.followUp,
  
      Date: record.recordDate,
      "Last Contact Date": record.lastContactDate,
      "Due Date": record.dueDate,
  
      "Payment Status": record.paymentStatus,
  
      Contacted: record.contacted,
      "Estimate Sent": record.estimateSent,
  
      "Expiration Date": record.expirationDate,
  
      "Amount Paid": record.amountPaid,
  
      "Appointment Status": record.appointmentStatus,
      "Job Status": record.jobStatus,
  
      "Job Amount": record.jobAmount,
    };
  }