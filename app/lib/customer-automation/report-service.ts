import "server-only";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  buildCustomerReport,
  type ReportAnalysisSnapshot,
  type ReportLeakSnapshot,
} from "./report-generator";

export type SavedCustomerReport = {
  reportId: string;
  previousAnalysisId: string | null;
  leaksFound: number;
  newLeaks: number;
  resolvedLeaks: number;
};

export async function generateAndSaveCustomerReport(
  supabase: SupabaseClient,
  analysisId: string,
  businessId: string
): Promise<SavedCustomerReport> {
  const {
    data: currentAnalysis,
    error: currentAnalysisError,
  } = await supabase
    .from("analyses")
    .select(
      "id,business_id,total_leakage,estimated_recovery,created_at"
    )
    .eq(
      "id",
      analysisId
    )
    .eq(
      "business_id",
      businessId
    )
    .single();

  if (
    currentAnalysisError ||
    !currentAnalysis
  ) {
    throw new Error(
      `Could not load current analysis for report: ${
        currentAnalysisError?.message ??
        "analysis not found"
      }`
    );
  }

  const {
    data: currentLeaks,
    error: currentLeaksError,
  } = await supabase
    .from("leaks")
    .select(
      "customer,type,amount,recovery,severity,reason,action,status,priority_score,priority_level,recovered_amount"
    )
    .eq(
      "analysis_id",
      analysisId
    );

  if (currentLeaksError) {
    throw new Error(
      `Could not load current leaks for report: ${currentLeaksError.message}`
    );
  }

  const {
    data: previousAnalysis,
    error: previousAnalysisError,
  } = await supabase
    .from("analyses")
    .select(
      "id,business_id,total_leakage,estimated_recovery,created_at"
    )
    .eq(
      "business_id",
      businessId
    )
    .neq(
      "id",
      analysisId
    )
    .lt(
      "created_at",
      currentAnalysis.created_at
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (previousAnalysisError) {
    throw new Error(
      `Could not load previous analysis for report: ${previousAnalysisError.message}`
    );
  }

  let previousLeaks: ReportLeakSnapshot[] =
    [];

  if (previousAnalysis?.id) {
    const {
      data,
      error,
    } = await supabase
      .from("leaks")
      .select(
        "customer,type,amount,recovery,severity,reason,action,status,priority_score,priority_level,recovered_amount"
      )
      .eq(
        "analysis_id",
        previousAnalysis.id
      );

    if (error) {
      throw new Error(
        `Could not load previous leaks for report: ${error.message}`
      );
    }

    previousLeaks =
      (data ?? []) as ReportLeakSnapshot[];
  }

  const generated =
    buildCustomerReport(
      currentAnalysis as ReportAnalysisSnapshot,
      (currentLeaks ??
        []) as ReportLeakSnapshot[],
      previousAnalysis
        ? (
            previousAnalysis as
              ReportAnalysisSnapshot
          )
        : null,
      previousLeaks
    );

  const {
    data: saved,
    error: saveError,
  } = await supabase
    .from("customer_reports")
    .upsert(
      {
        business_id:
          businessId,

        analysis_id:
          analysisId,

        previous_analysis_id:
          previousAnalysis?.id ??
          null,

        status:
          "ready",

        scan_date:
          generated.scanDate,

        revenue_at_risk:
          generated.revenueAtRisk,

        estimated_recovery:
          generated.estimatedRecovery,

        recovered_amount:
          generated.recoveredAmount,

        leaks_found:
          generated.leaksFound,

        new_leaks:
          generated.newLeaks,

        resolved_leaks:
          generated.resolvedLeaks,

        previous_revenue_at_risk:
          generated.previousRevenueAtRisk,

        revenue_risk_change:
          generated.revenueRiskChange,

        top_leaks:
          generated.topLeaks,
      },
      {
        onConflict:
          "analysis_id",
      }
    )
    .select("id")
    .single();

  if (
    saveError ||
    !saved?.id
  ) {
    throw new Error(
      `Could not save customer report: ${
        saveError?.message ??
        "report id missing"
      }`
    );
  }

  return {
    reportId:
      saved.id,

    previousAnalysisId:
      previousAnalysis?.id ??
      null,

    leaksFound:
      generated.leaksFound,

    newLeaks:
      generated.newLeaks,

    resolvedLeaks:
      generated.resolvedLeaks,
  };
}
