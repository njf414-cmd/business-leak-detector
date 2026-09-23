import { del } from "@vercel/blob";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";

import {
  enqueueAnalysisJob,
} from "../../../lib/background/analysis-queue";
import {
  appConfig,
} from "../../../lib/config/app-config";
import {
  logger,
} from "../../../lib/observability/logger";
import {
  createSupabaseServerClient,
} from "../../../lib/supabase-server";
import {
  createSupabaseWorkerClient,
} from "../../../lib/supabase-worker";

export const runtime = "nodejs";

type UploadPayload = {
  jobId: string;
  fileName: string;
  industry?: string | null;
};

type TrustedUploadPayload =
  UploadPayload & {
    userId: string;
    businessId: string;
  };

function parsePayload(
  value: string | null | undefined
): UploadPayload {
  if (!value) {
    throw new Error(
      "Missing upload metadata."
    );
  }

  const parsed =
    JSON.parse(value) as Partial<UploadPayload>;

  if (
    typeof parsed.jobId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      parsed.jobId
    )
  ) {
    throw new Error(
      "Invalid analysis job id."
    );
  }

  if (
    typeof parsed.fileName !== "string" ||
    !parsed.fileName
      .toLowerCase()
      .endsWith(".csv")
  ) {
    throw new Error(
      "Only CSV files are supported."
    );
  }

  return {
    jobId: parsed.jobId,
    fileName:
      parsed.fileName.slice(0, 255),
    industry:
      typeof parsed.industry === "string"
        ? parsed.industry
        : null,
  };
}

function safeFileName(
  value: string
): string {
  const cleaned = value
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-"
    )
    .replace(
      /^[-.]+|[-.]+$/g,
      ""
    );

  return (
    cleaned || "analysis.csv"
  ).slice(0, 180);
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as HandleUploadBody;

    const result =
      await handleUpload({
        body,
        request,

        onBeforeGenerateToken:
          async (
            pathname,
            clientPayload
          ) => {
            const payload =
              parsePayload(
                clientPayload
              );

            const supabase =
              await createSupabaseServerClient();

            const {
              data: { user },
              error: userError,
            } =
              await supabase.auth.getUser();

            if (
              userError ||
              !user
            ) {
              throw new Error(
                "Not authenticated."
              );
            }

            const {
              data: business,
              error: businessError,
            } =
              await supabase
                .from("businesses")
                .select("id")
                .eq(
                  "user_id",
                  user.id
                )
                .order(
                  "created_at",
                  {
                    ascending: true,
                  }
                )
                .limit(1)
                .maybeSingle();

            if (
              businessError ||
              !business
            ) {
              throw new Error(
                "No business is available for this account."
              );
            }

            const expectedPath =
              `analysis-jobs/${user.id}/${payload.jobId}/${safeFileName(payload.fileName)}`;

            if (
              pathname !==
              expectedPath
            ) {
              throw new Error(
                "Invalid upload path."
              );
            }

            return {
              allowedContentTypes: [
                "text/csv",
                "text/plain",
                "application/csv",
                "application/vnd.ms-excel",
              ],
              maximumSizeInBytes:
                appConfig.limits
                  .maxUploadMb *
                1024 *
                1024,
              addRandomSuffix: false,
              allowOverwrite: false,
              tokenPayload:
                JSON.stringify({
                  ...payload,
                  userId: user.id,
                  businessId:
                    business.id,
                } satisfies TrustedUploadPayload),
            };
          },

        onUploadCompleted:
          async ({
            blob,
            tokenPayload,
          }) => {
            if (!tokenPayload) {
              throw new Error(
                "Missing trusted upload metadata."
              );
            }

            const trusted =
              JSON.parse(
                tokenPayload
              ) as TrustedUploadPayload;

            const expectedPrefix =
              `analysis-jobs/${trusted.userId}/${trusted.jobId}/`;

            if (
              !blob.pathname.startsWith(
                expectedPrefix
              )
            ) {
              throw new Error(
                "Completed upload does not match the authenticated analysis job."
              );
            }

            const worker =
              createSupabaseWorkerClient();

            const {
              data: existing,
              error: existingError,
            } =
              await worker
                .from(
                  "analysis_jobs"
                )
                .select(
                  "id,business_id,source_path,status"
                )
                .eq(
                  "id",
                  trusted.jobId
                )
                .maybeSingle();

            if (existingError) {
              throw new Error(
                `Could not inspect analysis job: ${existingError.message}`
              );
            }

            if (existing) {
              if (
                existing.business_id !==
                  trusted.businessId ||
                existing.source_path !==
                  blob.pathname
              ) {
                throw new Error(
                  "Analysis job id already belongs to a different upload."
                );
              }

              if (
                existing.status ===
                  "completed" ||
                existing.status ===
                  "processing"
              ) {
                return;
              }
            } else {
              const {
                error: insertError,
              } =
                await worker
                  .from(
                    "analysis_jobs"
                  )
                  .insert({
                    id: trusted.jobId,
                    business_id:
                      trusted.businessId,
                    status: "queued",
                    progress: 0,
                    source_file_name:
                      trusted.fileName,
                    source_path:
                      blob.pathname,
                    industry:
                      trusted.industry ??
                      null,
                    attempts: 0,
                    max_attempts: 3,
                  });

              if (insertError) {
                throw new Error(
                  `Could not create analysis job: ${insertError.message}`
                );
              }
            }

            try {
              await enqueueAnalysisJob(
                trusted.jobId
              );
            } catch (queueError) {
              const queueMessage =
                queueError instanceof Error
                  ? queueError.message
                  : "Unknown queue publish error";

              const {
                error: failJobError,
              } =
                await worker
                  .from(
                    "analysis_jobs"
                  )
                  .update({
                    status: "failed",
                    progress: 0,
                    error_message:
                      `Queue publish failed: ${queueMessage}`.slice(
                        0,
                        2000
                      ),
                    completed_at:
                      new Date().toISOString(),
                    updated_at:
                      new Date().toISOString(),
                  })
                  .eq(
                    "id",
                    trusted.jobId
                  )
                  .eq(
                    "status",
                    "queued"
                  );

              if (failJobError) {
                logger.warn(
                  "analysis_job.queue_failure_status_failed",
                  {
                    jobId:
                      trusted.jobId,
                    error:
                      failJobError.message,
                  }
                );
              }

              try {
                await del(
                  blob.pathname
                );
              } catch (cleanupError) {
                logger.warn(
                  "analysis_job.queue_failure_blob_cleanup_failed",
                  {
                    jobId:
                      trusted.jobId,
                    error:
                      cleanupError instanceof Error
                        ? cleanupError.message
                        : "Unknown Blob cleanup error",
                  }
                );
              }

              throw new Error(
                `Could not queue analysis job: ${queueMessage}`
              );
            }

            logger.info(
              "analysis_job.queued",
              {
                jobId:
                  trusted.jobId,
                businessId:
                  trusted.businessId,
              }
            );
          },
      });

    return NextResponse.json(
      result
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Upload request failed.";

    logger.warn(
      "analysis_job.upload_failed",
      {
        error: message,
      }
    );

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          message ===
          "Not authenticated."
            ? 401
            : 400,
      }
    );
  }
}
