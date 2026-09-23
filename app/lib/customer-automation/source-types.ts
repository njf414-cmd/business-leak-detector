export type CustomerScanSource = {
  business_id: string;
  source_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  industry: string | null;
  mapping_overrides: Record<string, string>;
  uploaded_at: string;
  updated_at: string;
};

export type CustomerScanSourceUpsert = {
  business_id: string;
  source_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  industry?: string | null;
  mapping_overrides?: Record<string, string>;
};
