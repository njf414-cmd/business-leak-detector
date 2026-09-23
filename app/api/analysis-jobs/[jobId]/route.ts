import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
} from "../../../lib/supabase-server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      jobId: string;
    }>;
  }
) {
  const { jobId } =
    await context.params;

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
    return NextResponse.json(
      {
        success: false,
        error:
          "Not authenticated.",
      },
      {
        status: 401,
      }
    );
  }

  const {
    data: job,
    error,
  } =
    await supabase
      .from("analysis_jobs")
      .select(
        "id,analysis_id,status,progress,source_file_name,attempts,max_attempts,error_message,created_at,started_at,completed_at,updated_at"
      )
      .eq(
        "id",
        jobId
      )
      .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Could not load analysis job.",
      },
      {
        status: 500,
      }
    );
  }

  if (!job) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Analysis job not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,
    job,
  });
}
