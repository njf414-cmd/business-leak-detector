import "server-only";

import { send } from "@vercel/queue";

export const ANALYSIS_QUEUE_TOPIC = "analysis-jobs";

export type AnalysisJobMessage = {
  jobId: string;
};

export async function enqueueAnalysisJob(
  jobId: string
) {
  return send<AnalysisJobMessage>(
    ANALYSIS_QUEUE_TOPIC,
    { jobId },
    {
      idempotencyKey: `analysis-job:${jobId}`,
      retentionSeconds: 24 * 60 * 60,
    }
  );
}
