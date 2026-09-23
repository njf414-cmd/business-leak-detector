import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { enqueueAnalysisJob } from "../../../lib/background/analysis-queue";
import { calculateNextScanAt } from "../../../lib/customer-automation/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly";

function createWorkerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "Recurring dispatcher Supabase configuration is missing."
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

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return (
    request.headers.get("authorization") ===
    `Bearer ${secret}`
  );
}

function getNextFutureScan(
  frequency: RecurringFrequency,
  dueAt: string,
  timeZone: string,
  now: Date
) {
  let cursor = new Date(dueAt);

  if (Number.isNaN(cursor.getTime())) {
    cursor = new Date(now);
  }

  for (let i = 0; i < 48; i++) {
    const next = calculateNextScanAt(
      frequency,
      cursor,
      timeZone
    );

    if (!next) {
      return null;
    }

    if (next.getTime() > now.getTime()) {
      return next;
    }

    cursor = next;
  }

  return new Date(
    now.getTime() + 24 * 60 * 60 * 1000
  );
}

async function repairTerminalLocks(
  supabase: ReturnType<typeof createWorkerSupabase>
) {
  const { data: locked, error } = await supabase
    .from("customer_automation_settings")
    .select("business_id,active_job_id")
    .not("active_job_id", "is", null)
    .limit(100);

  if (error) {
    throw new Error(
      `Could not inspect recurring scan locks: ${error.message}`
    );
  }

  let repaired = 0;

  for (const setting of locked ?? []) {
    if (!setting.active_job_id) {
      continue;
    }

    const { data: job, error: jobError } = await supabase
      .from("analysis_jobs")
      .select("status,completed_at")
      .eq("id", setting.active_job_id)
      .maybeSingle();

    if (jobError) {
      continue;
    }

    const terminal =
      !job ||
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled";

    if (!terminal) {
      continue;
    }

    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      active_job_id: null,
      updated_at: now,
    };

    if (
      job?.status === "completed" &&
      job.completed_at
    ) {
      updates.last_scan_at = job.completed_at;
    }

    const { error: repairError } = await supabase
      .from("customer_automation_settings")
      .update(updates)
      .eq("business_id", setting.business_id)
      .eq("active_job_id", setting.active_job_id);

    if (!repairError) {
      repaired++;
    }
  }

  return repaired;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized recurring scan dispatcher request.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const supabase = createWorkerSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  const dryRun =
    request.nextUrl.searchParams.get("dryRun") === "1";

  try {
    let repaired = 0;

    if (!dryRun) {
      repaired = await repairTerminalLocks(supabase);
    }

    const { data: dueSettings, error: dueError } =
      await supabase
        .from("customer_automation_settings")
        .select(
          "business_id,report_frequency,timezone,next_scan_at"
        )
        .eq("recurring_scans_enabled", true)
        .eq("onboarding_status", "ready")
        .eq("data_status", "ready")
        .is("active_job_id", null)
        .not("next_scan_at", "is", null)
        .lte("next_scan_at", nowIso)
        .neq("report_frequency", "manual")
        .order("next_scan_at", {
          ascending: true,
        })
        .limit(25);

    if (dueError) {
      throw new Error(
        `Could not load due recurring scans: ${dueError.message}`
      );
    }

    if (dryRun) {
      return NextResponse.json(
        {
          success: true,
          dryRun: true,
          due: dueSettings?.length ?? 0,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    let queued = 0;
    let skipped = 0;
    let failed = 0;

    const failures: Array<{
      businessId: string;
      error: string;
    }> = [];

    for (const setting of dueSettings ?? []) {
      const businessId = setting.business_id;

      try {
        const { data: source, error: sourceError } =
          await supabase
            .from("customer_scan_sources")
            .select(
              "source_path,file_name,industry,mapping_overrides"
            )
            .eq("business_id", businessId)
            .maybeSingle();

        if (sourceError) {
          throw new Error(
            `Could not load recurring scan source: ${sourceError.message}`
          );
        }

        if (!source?.source_path || !source.file_name) {
          await supabase
            .from("customer_automation_settings")
            .update({
              data_status: "error",
              next_scan_at: null,
              updated_at: nowIso,
            })
            .eq("business_id", businessId);

          skipped++;
          continue;
        }

        const frequency =
          setting.report_frequency as RecurringFrequency;

        const nextScan = getNextFutureScan(
          frequency,
          setting.next_scan_at,
          setting.timezone || "America/New_York",
          now
        );

        if (!nextScan) {
          throw new Error(
            "Could not calculate next recurring scan."
          );
        }

        const jobId = crypto.randomUUID();

        const { error: insertError } = await supabase
          .from("analysis_jobs")
          .insert({
            id: jobId,
            business_id: businessId,
            status: "queued",
            progress: 0,
            source_file_name: source.file_name,
            source_path: source.source_path,
            industry: source.industry ?? null,
            mapping_overrides:
              source.mapping_overrides ?? {},
            attempts: 0,
            max_attempts: 3,
          });

        if (insertError) {
          throw new Error(
            `Could not create recurring analysis job: ${insertError.message}`
          );
        }

        const { data: lock, error: lockError } =
          await supabase
            .from("customer_automation_settings")
            .update({
              active_job_id: jobId,
              next_scan_at: nextScan.toISOString(),
              updated_at: nowIso,
            })
            .eq("business_id", businessId)
            .is("active_job_id", null)
            .lte("next_scan_at", nowIso)
            .select("business_id")
            .maybeSingle();

        if (lockError || !lock) {
          await supabase
            .from("analysis_jobs")
            .delete()
            .eq("id", jobId);

          skipped++;
          continue;
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

          const retryAt = new Date(
            Date.now() + 15 * 60 * 1000
          ).toISOString();

          await supabase
            .from("customer_automation_settings")
            .update({
              active_job_id: null,
              next_scan_at: retryAt,
              updated_at: failedAt,
            })
            .eq("business_id", businessId)
            .eq("active_job_id", jobId);

          throw queueError;
        }

        queued++;
      } catch (error) {
        failed++;

        failures.push({
          businessId,
          error:
            error instanceof Error
              ? error.message
              : "Unknown recurring dispatch failure",
        });
      }
    }

    return NextResponse.json(
      {
        success: failed === 0,
        repaired,
        processed: dueSettings?.length ?? 0,
        queued,
        skipped,
        failed,
        failures,
      },
      {
        status: failed > 0 ? 207 : 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown recurring dispatcher failure",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
