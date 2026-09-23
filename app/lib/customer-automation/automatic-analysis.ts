import { createClient } from "@supabase/supabase-js";

import { enqueueAnalysisJob } from "../background/analysis-queue";

type MappingOverrides = Record<string, unknown>;

type AutomaticAnalysisInput = {
  businessId: string;
  sourcePath: string;
  fileName: string;
  industry?: string | null;
  mappingOverrides?: MappingOverrides | null;
};

export type AutomaticAnalysisResult =
  | {
      queued: true;
      skipped: false;
      jobId: string;
    }
  | {
      queued: false;
      skipped: true;
      jobId: null;
      reason: "active_job";
    };

function createWorkerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "Automatic analysis Supabase configuration is missing."
    );
  }

  return createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function dispatchAutomaticCustomerAnalysis(
  input: AutomaticAnalysisInput
): Promise<AutomaticAnalysisResult> {
  const supabase = createWorkerSupabase();

  const { data: settings, error: settingsError } =
    await supabase
      .from("customer_automation_settings")
      .select("business_id,active_job_id")
      .eq("business_id", input.businessId)
      .maybeSingle();

  if (settingsError) {
    throw new Error(
      `Could not inspect customer automation lock: ${settingsError.message}`
    );
  }

  if (!settings) {
    throw new Error(
      "Customer automation settings do not exist for this business."
    );
  }

  if (settings.active_job_id) {
    return {
      queued: false,
      skipped: true,
      jobId: null,
      reason: "active_job",
    };
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("analysis_jobs")
    .insert({
      id: jobId,
      business_id: input.businessId,
      status: "queued",
      progress: 0,
      source_file_name: input.fileName,
      source_path: input.sourcePath,
      industry: input.industry ?? null,
      mapping_overrides: input.mappingOverrides ?? {},
      attempts: 0,
      max_attempts: 3,
    });

  if (insertError) {
    throw new Error(
      `Could not create automatic analysis job: ${insertError.message}`
    );
  }

  const { data: lock, error: lockError } =
    await supabase
      .from("customer_automation_settings")
      .update({
        active_job_id: jobId,
        data_status: "ready",
        updated_at: now,
      })
      .eq("business_id", input.businessId)
      .is("active_job_id", null)
      .select("business_id")
      .maybeSingle();

  if (lockError || !lock) {
    await supabase
      .from("analysis_jobs")
      .delete()
      .eq("id", jobId);

    return {
      queued: false,
      skipped: true,
      jobId: null,
      reason: "active_job",
    };
  }

  try {
    await enqueueAnalysisJob(jobId);
  } catch (queueError) {
    const message =
      queueError instanceof Error
        ? queueError.message
        : "Queue publish failed.";

    const failedAt = new Date().toISOString();

    await supabase
      .from("analysis_jobs")
      .update({
        status: "failed",
        progress: 0,
        error_message: message.slice(0, 2000),
        completed_at: failedAt,
        updated_at: failedAt,
      })
      .eq("id", jobId);

    await supabase
      .from("customer_automation_settings")
      .update({
        active_job_id: null,
        updated_at: failedAt,
      })
      .eq("business_id", input.businessId)
      .eq("active_job_id", jobId);

    throw queueError;
  }

  return {
    queued: true,
    skipped: false,
    jobId,
  };
}
