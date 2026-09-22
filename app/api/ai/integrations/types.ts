export type IntegrationProvider =
  | "square"
  | "quickbooks"
  | "stripe"
  | "hubspot"
  | "salesforce"
  | "jobber"
  | "housecall_pro"
  | "shopify"
  | "generic_api"
  | "database";

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "syncing"
  | "error"
  | "reauthorization_required";

export type IntegrationDataType =
  | "customers"
  | "leads"
  | "quotes"
  | "invoices"
  | "payments"
  | "appointments"
  | "jobs"
  | "orders"
  | "transactions"
  | "communications"
  | "other";

export type IntegrationConnection = {
  id: string;
  businessId: string;

  provider: IntegrationProvider;
  status: IntegrationStatus;

  displayName: string;

  dataTypes: IntegrationDataType[];

  lastSyncStartedAt: string | null;
  lastSuccessfulSyncAt: string | null;

  lastSyncError: string | null;

  createdAt: string;
  updatedAt: string;
};

export type RawIntegrationRecord = {
  provider: IntegrationProvider;

  sourceRecordId: string;

  dataType: IntegrationDataType;

  sourceUpdatedAt: string | null;

  data: Record<string, unknown>;
};

export type IntegrationSyncResult = {
  provider: IntegrationProvider;

  success: boolean;

  recordsReceived: number;
  recordsNormalized: number;
  recordsRejected: number;

  startedAt: string;
  completedAt: string;

  errors: string[];
};

export interface IntegrationConnector {
  provider: IntegrationProvider;

  testConnection(): Promise<boolean>;

  fetchRecords(
    dataTypes: IntegrationDataType[]
  ): Promise<RawIntegrationRecord[]>;

  sync(
    dataTypes: IntegrationDataType[]
  ): Promise<IntegrationSyncResult>;
}