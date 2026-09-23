import { generateAndSaveCustomerReport } from "../../../lib/customer-automation/report-service";
import { prepareCustomerReportNotification } from "../../../lib/customer-automation/notification-service";
import { enqueueNotificationDelivery } from "../../../lib/background/notification-queue";
import { del, get } from "@vercel/blob";
import { handleCallback } from "@vercel/queue";
import { NextRequest } from "next/server";

import { POST as analyzeCsv } from "../../analyze-csv/route";
import type {
  AnalysisJobMessage,
} from "../../../lib/background/analysis-queue";
import {
  createSupabaseWorkerClient,
} from "../../../lib/supabase-worker";
import {
  logger,
} from "../../../lib/observability/logger";

export const runtime = "nodejs";

type WorkerLeak = {
  customer?: string;
  type?: string;
  category?: string;
  amount?: number;
  recovery?: number;
  severity?: string;
  reason?: string;
  action?: string;
  date?: string | null;
  daysOpen?: number | null;
  status?: string;
  priorityScore?: number;
  priorityLevel?: string;
};

type AnalysisPayload = {
  success?: boolean;
  error?: string;
  leaks?: WorkerLeak[];
  detectedLeaks?: WorkerLeak[];
  result?: {
    leaks?: WorkerLeak[];
  };
  analysis?: {
    performed?: boolean;
    leaks?: WorkerLeak[];
  };
};

function extractLeaks(
  payload: AnalysisPayload
): WorkerLeak[] {
  if (Array.isArray(payload.leaks)) {
    return payload.leaks;
  }

  if (Array.isArray(payload.detectedLeaks)) {
    return payload.detectedLeaks;
  }

  if (Array.isArray(payload.result?.leaks)) {
    return payload.result.leaks;
  }

  if (Array.isArray(payload.analysis?.leaks)) {
    return payload.analysis.leaks;
  }

  return [];
}

async function cleanupBlob(
  sourcePath: string
) {
  if (sourcePath.startsWith("customer-scan-sources/")) {
    return;
  }

  try {
    await del(sourcePath);
  } catch (error) {
    logger.warn("analysis_job.blob_cleanup_failed", {
      sourcePath,
      error:
        error instanceof Error
          ? error.message
          : "Unknown Blob cleanup error",
    });
  }
}

export const POST = handleCallback<AnalysisJobMessage>(
  async (message, metadata) => {
    const { jobId } = message;

    if (!jobId || typeof jobId !== "string") {
      throw new Error(
        "Queue message is missing jobId."
      );
    }

    const supabase =
      createSupabaseWorkerClient();

    const workerId =
      `vercel:${metadata.messageId}`;

    const {
      data: claimRows,
      error: claimError,
    } = await supabase.rpc(
      "claim_analysis_job",
      {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_stale_after_seconds: 900,
      }
    );

    if (claimError) {
      throw new Error(
        `Could not claim analysis job: ${claimError.message}`
      );
    }

    const job =
      Array.isArray(claimRows)
        ? claimRows[0]
        : null;

    if (!job) {
      logger.info("analysis_job.not_claimed", {
        jobId,
        messageId: metadata.messageId,
        deliveryCount: metadata.deliveryCount,
      });
      return;
    }

    logger.info("analysis_job.claimed", {
      jobId,
      attempts: job.attempts,
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
    });

    try {
      const blobResult = await get(
        job.source_path,
        {
          access: "private",
          useCache: false,
        }
      );

      if (
        !blobResult ||
        blobResult.statusCode !== 200
      ) {
        throw new Error(
          "Source CSV could not be read from private Blob storage."
        );
      }

      const bytes =
        await new Response(
          blobResult.stream
        ).arrayBuffer();

      const fileName =
        job.source_file_name ||
        "analysis.csv";

      const file = new File(
        [bytes],
        fileName,
        {
          type:
            blobResult.blob.contentType ||
            "text/csv",
        }
      );

      const formData =
        new FormData();

      formData.set("file", file);

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", job.business_id)
        .single();

      if (businessError) {
        throw new Error(
          `Could not load job business: ${businessError.message}`
        );
      }

      if (business?.name) {
        formData.set(
          "businessName",
          business.name
        );
      }

      if (job.industry) {
        formData.set(
          "industry",
          job.industry
        );
      }

      const request =
        new NextRequest(
          "http://internal/api/analyze-csv",
          {
            method: "POST",
            body: formData,
          }
        );

      const analysisResponse =
        await analyzeCsv(request);

      const payload =
        (await analysisResponse.json()) as AnalysisPayload;

      if (
        !analysisResponse.ok ||
        payload.success === false
      ) {
        throw new Error(
          payload.error ||
          `Analyzer returned HTTP ${analysisResponse.status}.`
        );
      }

      if (payload.analysis?.performed === false) {
        throw new Error(
          payload.error ||
            "Analysis could not run on the uploaded data."
        );
      }

      const detectedLeaks =
        extractLeaks(payload);

      const recoverable =
        detectedLeaks.filter(
          (leak) =>
            leak.category === "Recoverable"
        );

      const totalLeakage =
        recoverable.reduce(
          (total, leak) =>
            total +
            Number(leak.amount || 0),
          0
        );

      const estimatedRecovery =
        recoverable.reduce(
          (total, leak) =>
            total +
            Number(leak.recovery || 0),
          0
        );

      /*
       * Deterministic analysis id:
       * one background job can create only
       * one analysis, even after retries.
       */
      const analysisId = jobId;

      const {
        error: analysisError,
      } = await supabase
        .from("analyses")
        .upsert(
          {
            id: analysisId,
            business_id:
              job.business_id,
            file_name: fileName,
            total_leakage:
              totalLeakage,
            estimated_recovery:
              estimatedRecovery,
          },
          {
            onConflict: "id",
          }
        );

      if (analysisError) {
        throw new Error(
          `Could not save analysis: ${analysisError.message}`
        );
      }

      /*
       * A retry replaces this job's leak
       * snapshot instead of duplicating it.
       */
      const {
        error: deleteLeaksError,
      } = await supabase
        .from("leaks")
        .delete()
        .eq(
          "analysis_id",
          analysisId
        );

      if (deleteLeaksError) {
        throw new Error(
          `Could not reset analysis leaks: ${deleteLeaksError.message}`
        );
      }

      const leakRows =
        detectedLeaks.map(
          (leak) => ({
            id: crypto.randomUUID(),
            analysis_id:
              analysisId,
            customer:
              leak.customer ||
              "Unknown",
            type:
              leak.type ||
              "Unknown",
            category:
              leak.category ||
              "Recoverable",
            amount:
              Number(
                leak.amount || 0
              ),
            recovery:
              Number(
                leak.recovery || 0
              ),
            severity:
              leak.severity ||
              "medium",
            reason:
              leak.reason || "",
            action:
              leak.action || "",
            date:
              leak.date ?? null,
            days_open:
              leak.daysOpen ?? null,
            status:
              leak.status || "Open",
            priority_score:
              Number(
                leak.priorityScore || 0
              ),
            priority_level:
              leak.priorityLevel ||
              "Medium",
            notes: "",
            follow_up_date: null,
            contact_attempts: 0,
            last_contacted_at: null,
            recovered_amount: 0,
            recovered_at: null,
          })
        );

      if (leakRows.length > 0) {
        const {
          error: leaksError,
        } = await supabase
          .from("leaks")
          .insert(leakRows);

        if (leaksError) {
          throw new Error(
            `Could not save leaks: ${leaksError.message}`
          );
        }
      }

      const generatedReport =
        await generateAndSaveCustomerReport(
          supabase,
          analysisId,
          job.business_id
        );

      logger.info(
        "customer_report.generated",
        {
          jobId,
          analysisId,
          reportId:
            generatedReport.reportId,
          previousAnalysisId:
            generatedReport.previousAnalysisId,
          leaksFound:
            generatedReport.leaksFound,
          newLeaks:
            generatedReport.newLeaks,
          resolvedLeaks:
            generatedReport.resolvedLeaks,
        }
      );

      try {
        const preparedNotification =
          await prepareCustomerReportNotification(
            supabase,
            generatedReport.reportId,
            job.business_id
          );

        if (
          preparedNotification.status === "queued" &&
          preparedNotification.deliveryId
        ) {
          await enqueueNotificationDelivery(
            preparedNotification.deliveryId
          );
        }

        logger.info(
          "customer_notification.queued",
          {
            jobId,
            analysisId,
            reportId:
              generatedReport.reportId,
            deliveryId:
              preparedNotification.deliveryId,
            status:
              preparedNotification.status,
            reason:
              preparedNotification.reason,
          }
        );
      } catch (notificationError) {
        logger.warn(
          "customer_notification.queue_failed",
          {
            jobId,
            analysisId,
            reportId:
              generatedReport.reportId,
            error:
              notificationError instanceof Error
                ? notificationError.message
                : "Unknown notification queue error",
          }
        );
      }

      const {
        error: completeError,
      } = await supabase
        .from("analysis_jobs")
        .update({
          analysis_id:
            analysisId,
          status: "completed",
          progress: 100,
          completed_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          error_message: null,
        })
        .eq("id", jobId)
        .eq(
          "locked_by",
          workerId
        );

      if (completeError) {
        throw new Error(
          `Could not complete analysis job: ${completeError.message}`
        );
      }

      const recurringCompletedAt =
        new Date().toISOString();

      const { error: recurringCompleteError } =
        await supabase
          .from("customer_automation_settings")
          .update({
            active_job_id: null,
            last_scan_at: recurringCompletedAt,
            updated_at: recurringCompletedAt,
          })
          .eq("active_job_id", jobId);

      if (recurringCompleteError) {
        logger.warn(
          "recurring_scan.completed_lock_release_failed",
          {
            jobId,
            error: recurringCompleteError.message,
          }
        );
      }

      await cleanupBlob(
        job.source_path
      );

      logger.info(
        "analysis_job.completed",
        {
          jobId,
          analysisId,
          attempts: job.attempts,
          leaksFound:
            detectedLeaks.length,
          totalEstimatedLoss:
            totalLeakage,
          totalEstimatedRecovery:
            estimatedRecovery,
        }
      );
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Unknown background analysis error";

      const terminal =
        Number(job.attempts) >=
        Number(job.max_attempts);

      await supabase
        .from("analysis_jobs")
        .update({
          status:
            terminal
              ? "failed"
              : "queued",
          progress: 0,
          error_message:
            messageText.slice(
              0,
              2000
            ),
          updated_at:
            new Date().toISOString(),
          completed_at:
            terminal
              ? new Date().toISOString()
              : null,
          locked_at: null,
          locked_by: null,
        })
        .eq("id", jobId)
        .eq(
          "locked_by",
          workerId
        );

      if (terminal) {
        const recurringFailedAt =
          new Date().toISOString();

        const { error: recurringFailureUnlockError } =
          await supabase
            .from("customer_automation_settings")
            .update({
              active_job_id: null,
              updated_at: recurringFailedAt,
            })
            .eq("active_job_id", jobId);

        if (recurringFailureUnlockError) {
          logger.warn(
            "recurring_scan.failed_lock_release_failed",
            {
              jobId,
              error:
                recurringFailureUnlockError.message,
            }
          );
        }

        await cleanupBlob(
          job.source_path
        );
      }

      logger.warn(
        "analysis_job.failed",
        {
          jobId,
          attempts: job.attempts,
          terminal,
          error: messageText,
        }
      );

      throw error;
    }
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (_error, metadata) => {
      if (
        metadata.deliveryCount >= 3
      ) {
        return {
          acknowledge: true,
        };
      }

      return {
        afterSeconds:
          Math.min(
            300,
            15 *
              2 **
                Math.max(
                  0,
                  metadata.deliveryCount - 1
                )
          ),
      };
    },
  }
);
