"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { upload } from "@vercel/blob/client";

import {
  type LeakCategory,
  type LeakType,
} from "./lib/leak-engine";

import {
  prioritizeLeaks,
  type PrioritizedLeak,
} from "./lib/priority-engine";

import { supabase } from "./lib/supabase";
import CsvImportFlow from "./components/CsvImportFlow";
import { requestCsvAnalysis, toDashboardLeaks, type CsvDashboardResult } from "./lib/csv-dashboard";

/* ================================== */
/* TYPES */
/* ================================== */

type LeakStatus = "Open" | "Contacted" | "Recovered" | "Dismissed";

type FollowUpGroup = "Overdue" | "Today" | "Upcoming";

type SourceRow = Record<string, string | number | boolean | null>;

type TrackedLeak = PrioritizedLeak & {
  status: LeakStatus;
  dbId?: string;
  notes: string;
  followUpDate: string;
  contactAttempts: number;
  lastContactedAt: string | null;
  recoveredAmount: number;
  recoveredAt: string | null;
};

type AnalysisRecord = {
  id: string;
  file_name: string | null;
  total_leakage: number | string | null;
  estimated_recovery: number | string | null;
  created_at: string;
};

type SavedLeakRow = {
  id: string;
  customer: string;
  type: string;
  category: string | null;
  amount: number | string;
  recovery: number | string;
  severity: PrioritizedLeak["severity"];
  reason: string;
  action: string;
  date: string | null;
  days_open: number | string | null;
  status: string | null;
  priority_score: number | string | null;
  priority_level: PrioritizedLeak["priorityLevel"] | null;
  notes: string | null;
  follow_up_date: string | null;
  contact_attempts: number | string | null;
  last_contacted_at: string | null;
  recovered_amount: number | string | null;
  recovered_at: string | null;
};

type BreakdownItem = {
  name: string;
  count: number;
  amount: number;
  recovery: number;
};

type HistoricalAnalysis = {
  id: string;
  date: string;
  fileName: string;
  revenueAtRisk: number;
  estimatedRecovery: number;
};

type AIBusinessSummary = {
  headline: string;
  overview: string;
  healthStatus: "stable" | "attention" | "critical";
  priorityFocus: string;
  biggestLeakArea: string;
  biggestLeakExplanation: string;
  trendDirection: "improving" | "worsening" | "stable" | "unknown";
  trendExplanation: string;
  ownerFocus: string[];
};

type AIAnalysis = {
  executiveSummary: string;
  rootCause: string;
  highestPriorityAction: string;
  recoveryStrategy: string;
  confidence: "low" | "medium" | "high";
  insights: {
    title: string;
    explanation: string;
    recommendedAction: string;
  }[];
  businessSummary?: AIBusinessSummary;
};

type AIDiscoveryConfidence = "low" | "medium" | "high";

type AIDiscoveryItem = {
  title: string;
  category: "Revenue Opportunity" | "Workflow Gap" | "Customer Pattern" |
    "Operational Pattern" | "Data Quality" | "Other";
  description: string;
  evidence: string[];
  affectedRecords: number;
  estimatedImpact: number;
  confidence: AIDiscoveryConfidence;
  priority: "Critical" | "High" | "Medium" | "Low";
  recommendedReview: string;
  recommendedAction: string;
};

type AIDiscovery = {
  summary: string;
  discoveryCount: number;
  overallConfidence: AIDiscoveryConfidence;
  discoveries: AIDiscoveryItem[];
};

type AIDiscoveryResponse = {
  success: true;
  discovery: AIDiscovery;
  metadata: {
    rowsAnalyzed: number;
    rowsLimited: boolean;
    confirmedLeaksProvided: number;
  };
} | { success?: false; error: string };

type AIRecoveryPlan = {
  recoverySummary: string;
  nextBestAction: string;
  contactStrategy: string;
  customerMessage: string;
  email: {
    subject: string;
    body: string;
  };
  phoneScript: string;
  objectionHandling: {
    objection: string;
    response: string;
  }[];
  followUpPlan: {
    step: string;
    timing: string;
    action: string;
  }[];
  stopConditions: string[];
  confidence: "low" | "medium" | "high";
};

/* ================================== */
/* LEAK TYPES */
/* ================================== */

const LEAK_TYPES: { value: LeakType; label: string }[] = [
  { value: "Abandoned Lead", label: "Abandoned Leads" },
  { value: "Unbooked Lead", label: "Unbooked Leads" },
  { value: "Stale Lead", label: "Stale Leads" },
  { value: "Lost Lead", label: "Lost Leads" },
  { value: "Unsent Estimate", label: "Unsent Estimates" },
  { value: "Unfollowed Estimate", label: "Unfollowed Estimates" },
  { value: "Stale Estimate", label: "Stale Estimates" },
  { value: "Expired Estimate", label: "Expired Estimates" },
  { value: "Unpaid Invoice", label: "Unpaid Invoices" },
  { value: "Overdue Invoice", label: "Overdue Invoices" },
  { value: "Failed Payment", label: "Failed Payments" },
  { value: "Partial Payment", label: "Partial Payments" },
  { value: "No-Show", label: "No-Shows" },
  { value: "Cancelled Job", label: "Cancelled Jobs" },
];

const LEAD_TYPES: LeakType[] = [
  "Abandoned Lead",
  "Unbooked Lead",
  "Stale Lead",
  "Lost Lead",
];

const ESTIMATE_TYPES: LeakType[] = [
  "Unsent Estimate",
  "Unfollowed Estimate",
  "Stale Estimate",
  "Expired Estimate",
];

const PAYMENT_TYPES: LeakType[] = [
  "Unpaid Invoice",
  "Overdue Invoice",
  "Failed Payment",
  "Partial Payment",
];

const JOB_TYPES: LeakType[] = ["No-Show", "Cancelled Job"];

const LOST_TYPES: LeakType[] = ["No-Show", "Cancelled Job", "Lost Lead"];

/* ================================== */
/* HELPERS */
/* ================================== */

// Validate the network boundary before rendering model-generated fields.
function isAIDiscoveryResponse(value: unknown): value is Extract<AIDiscoveryResponse, { success: true }> {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (response.success !== true || !response.discovery || typeof response.discovery !== "object") return false;
  const discovery = response.discovery as Record<string, unknown>;
  const confidence = (v: unknown) => v === "low" || v === "medium" || v === "high";
  const count = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0;
  if (typeof discovery.summary !== "string" || !confidence(discovery.overallConfidence) ||
      !count(discovery.discoveryCount) || !Array.isArray(discovery.discoveries)) return false;
  const validItems = discovery.discoveries.every((value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return ["title", "description", "recommendedReview", "recommendedAction"].every(key => typeof item[key] === "string") &&
      ["Revenue Opportunity", "Workflow Gap", "Customer Pattern", "Operational Pattern", "Data Quality", "Other"].includes(String(item.category)) &&
      ["Critical", "High", "Medium", "Low"].includes(String(item.priority)) &&
      confidence(item.confidence) && count(item.affectedRecords) &&
      typeof item.estimatedImpact === "number" && Number.isFinite(item.estimatedImpact) &&
      Array.isArray(item.evidence) && item.evidence.every(entry => typeof entry === "string");
  });
  if (!response.metadata || typeof response.metadata !== "object") return false;
  const metadata = response.metadata as Record<string, unknown>;
  return validItems && count(metadata.rowsAnalyzed) && count(metadata.confirmedLeaksProvided) && typeof metadata.rowsLimited === "boolean";
}

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function calculateChange(current: number, previous: number) {
  if (previous === 0) {
    return {
      amount: current - previous,
      percent: null as number | null,
    };
  }

  return {
    amount: current - previous,
    percent: ((current - previous) / previous) * 100,
  };
}

function formatAnalysisDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatContactDate(date: string | null) {
  if (!date) return "Never";

  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFollowUpDate(date: string) {
  if (!date) return "—";

  const [year, month, day] = date.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLocalDateString() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function getCategoryFromType(type: LeakType): LeakCategory {
  return LOST_TYPES.includes(type) ? "Lost" : "Recoverable";
}

function getLeakKey(leak: TrackedLeak) {
  return leak.dbId || `${leak.customer}-${leak.type}-${leak.amount}`;
}

function parseSourceRows(csvText: string): SourceRow[] {
  const workbook = XLSX.read(csvText, {
    type: "string",
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json<SourceRow>(worksheet, {
    defval: null,
    raw: false,
  });
}

/* ================================== */
/* PAGE */
/* ================================== */

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "Dashboard" | "Leaks" | "Analytics" | "Data"
  >("Dashboard");

  const [workspaceSource, setWorkspaceSource] = useState<"queue" | "list">(
    "list"
  );

  const [fileName, setFileName] = useState("");
  const [leaks, setLeaks] = useState<TrackedLeak[]>([]);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");

  const [showTemplate, setShowTemplate] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(
    null
  );

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [deletingAnalysis, setDeletingAnalysis] = useState(false);

  const [savingRecovery, setSavingRecovery] = useState(false);
  const [recoverySaved, setRecoverySaved] = useState(false);

  const [filter, setFilter] = useState<"All" | LeakType>("All");
  const [search, setSearch] = useState("");

  const [selectedLeak, setSelectedLeak] = useState<string | null>(null);
  const [recoveredAmountInput, setRecoveredAmountInput] = useState("");

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [recoveryAIPlans, setRecoveryAIPlans] = useState<
    Record<string, AIRecoveryPlan>
  >({});

  const [recoveryAILoadingKey, setRecoveryAILoadingKey] = useState<
    string | null
  >(null);

  const [recoveryAIErrors, setRecoveryAIErrors] = useState<
    Record<string, string>
  >({});

  const [aiDiscovery, setAiDiscovery] = useState<AIDiscovery | null>(null);
  const [discoveryMetadata, setDiscoveryMetadata] = useState<
    Extract<AIDiscoveryResponse, { success: true }>["metadata"] | null
  >(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const discoveryRequest = useRef<AbortController | null>(null);

  function clearAIDiscovery() {
    discoveryRequest.current?.abort();
    discoveryRequest.current = null;
    setAiDiscovery(null);
    setDiscoveryMetadata(null);
    setDiscoveryLoading(false);
    setDiscoveryError("");
  }

  useEffect(() => {
    return () => {
      discoveryRequest.current?.abort();
      discoveryRequest.current = null;
    };
  }, []);

  function clearRecoveryAI() {
    setRecoveryAIPlans({});
    setRecoveryAILoadingKey(null);
    setRecoveryAIErrors({});
  }

  /* ================================== */
  /* BUSINESS */
  /* ================================== */

  async function getCurrentBusiness() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No logged-in user was found.");
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (businessError) throw businessError;

    if (!business) {
      throw new Error("No business is connected to this account.");
    }

    setBusinessId(business.id);
    setBusinessName(business.name);

    return business;
  }

  /* ================================== */
  /* RESTORE LEAKS */
  /* ================================== */

  function restoreLeaks(savedLeaks: SavedLeakRow[]): TrackedLeak[] {
    return (savedLeaks || []).map((leak) => {
      const type = leak.type as LeakType;

      const category: LeakCategory =
        leak.category === "Lost" || leak.category === "Recoverable"
          ? leak.category
          : getCategoryFromType(type);

      return {
        dbId: leak.id,
        customer: leak.customer,
        type,
        category,
        amount: Number(leak.amount) || 0,
        recovery: Number(leak.recovery) || 0,
        severity: leak.severity,
        reason: leak.reason,
        action: leak.action,
        date: leak.date || undefined,
        daysOpen:
          leak.days_open !== null ? Number(leak.days_open) : undefined,
        status: (leak.status as LeakStatus) || "Open",
        priorityScore: Number(leak.priority_score) || 0,
        priorityLevel: leak.priority_level || "Medium",
        notes: leak.notes || "",
        followUpDate: leak.follow_up_date || "",
        contactAttempts: Number(leak.contact_attempts) || 0,
        lastContactedAt: leak.last_contacted_at || null,
        recoveredAmount: Number(leak.recovered_amount) || 0,
        recoveredAt: leak.recovered_at || null,
      };
    });
  }

  const savedLeakSelect = `
    id,
    customer,
    type,
    category,
    amount,
    recovery,
    severity,
    reason,
    action,
    date,
    days_open,
    status,
    priority_score,
    priority_level,
    notes,
    follow_up_date,
    contact_attempts,
    last_contacted_at,
    recovered_amount,
    recovered_at
  `;

  /* ================================== */
  /* LOAD ANALYSIS */
  /* ================================== */

  async function loadAnalysis(analysis: AnalysisRecord) {
    if (importBusy) return;
    setLoadingAnalysis(true);
    setError("");
    setAiAnalysis(null);
    setAiError("");
    setSelectedLeak(null);
    setRecoveredAmountInput("");
    setFilter("All");
    setSearch("");
    setSourceRows([]);
    clearRecoveryAI();
    clearAIDiscovery();

    try {
      const { data: savedLeaks, error: leaksError } = await supabase
        .from("leaks")
        .select(savedLeakSelect)
        .eq("analysis_id", analysis.id)
        .order("priority_score", {
          ascending: false,
        });

      if (leaksError) throw leaksError;

      setLeaks(restoreLeaks((savedLeaks || []) as SavedLeakRow[]));

      setFileName(analysis.file_name || "Saved analysis");
      setSelectedAnalysisId(analysis.id);
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError("We couldn't load this analysis.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  /* ================================== */
  /* LOAD LATEST */
  /* ================================== */

  async function loadLatestAnalysis() {
    clearAIDiscovery();
    setLoading(true);
    setError("");

    try {
      const business = await getCurrentBusiness();

      const { data: analysisRows, error: analysisError } = await supabase
        .from("analyses")
        .select(
          "id, file_name, total_leakage, estimated_recovery, created_at"
        )
        .eq("business_id", business.id)
        .order("created_at", {
          ascending: false,
        });

      if (analysisError) throw analysisError;

      const history = (analysisRows || []) as AnalysisRecord[];

      setAnalyses(history);

      if (history.length === 0) {
        setLeaks([]);
        setSourceRows([]);
        setFileName("");
        setSaved(false);
        setSelectedAnalysisId(null);
        setFilter("All");
        setSearch("");
        setSelectedLeak(null);
        setRecoveredAmountInput("");
        setAiAnalysis(null);
        setAiError("");
        clearRecoveryAI();
        clearAIDiscovery();
        return;
      }

      const latest = history[0];

      const { data: savedLeaks, error: leaksError } = await supabase
        .from("leaks")
        .select(savedLeakSelect)
        .eq("analysis_id", latest.id)
        .order("priority_score", {
          ascending: false,
        });

      if (leaksError) throw leaksError;

      setLeaks(restoreLeaks((savedLeaks || []) as SavedLeakRow[]));

      setSourceRows([]);
      setFileName(latest.file_name || "Saved analysis");
      setSelectedAnalysisId(latest.id);
      setFilter("All");
      setSearch("");
      setSelectedLeak(null);
      setRecoveredAmountInput("");
      setAiAnalysis(null);
      setAiError("");
      clearRecoveryAI();
      clearAIDiscovery();
      setSaved(true);
    } catch (err) {
      console.error(err);

      const message = err instanceof Error ? err.message : "";

      if (message.includes("No business is connected")) {
        setError("Your account is not connected to a business yet.");
      } else if (message.includes("No logged-in user")) {
        setError(
          "Your login session could not be found. Please log in again."
        );
      } else {
        setError("We couldn't load your business data.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLatestAnalysis();
  }, []);

  /* ================================== */
  /* SAVE ANALYSIS */
  /* ================================== */

  async function saveAnalysis(file: File, detectedLeaks: TrackedLeak[]) {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      let currentBusinessId = businessId;

      if (!currentBusinessId) {
        const business = await getCurrentBusiness();
        currentBusinessId = business.id;
      }

      const recoverable = detectedLeaks.filter(
        (leak) => leak.category === "Recoverable"
      );

      const totalLeakage = recoverable.reduce(
        (total, leak) => total + leak.amount,
        0
      );

      const estimatedRecovery = recoverable.reduce(
        (total, leak) => total + leak.recovery,
        0
      );

      const { data: analysis, error: analysisError } = await supabase
        .from("analyses")
        .insert({
          business_id: currentBusinessId,
          file_name: file.name,
          total_leakage: totalLeakage,
          estimated_recovery: estimatedRecovery,
        })
        .select("id")
        .single();

      if (analysisError) throw analysisError;

      const leakRows = detectedLeaks.map((leak) => ({
        id: crypto.randomUUID(),
        analysis_id: analysis.id,
        customer: leak.customer,
        type: leak.type,
        category: leak.category,
        amount: leak.amount,
        recovery: leak.recovery,
        severity: leak.severity,
        reason: leak.reason,
        action: leak.action,
        date: leak.date ?? null,
        days_open: leak.daysOpen ?? null,
        status: leak.status,
        priority_score: leak.priorityScore,
        priority_level: leak.priorityLevel,
        notes: "",
        follow_up_date: null,
        contact_attempts: 0,
        last_contacted_at: null,
        recovered_amount: 0,
        recovered_at: null,
      }));

      if (leakRows.length > 0) {
        const { error: leaksError } = await supabase
          .from("leaks")
          .insert(leakRows);

        if (leaksError) {
          // Roll back only the analysis created by this attempt. Retrying a failed
          // bulk leak insert must not leave an empty scan in the history.
          const { error: rollbackError } = await supabase.from("analyses").delete().eq("id", analysis.id);
          if (rollbackError) console.error("Failed to clean up incomplete analysis", rollbackError);
          throw leaksError;
        }
      }

      /*
        IMPORTANT FOR 6E:
        Do not call loadLatestAnalysis() here.

        That function loads saved leaks from Supabase, but the original
        uploaded source rows are currently held in browser memory.

        Keeping the current page state allows the AI Discovery Layer to
        inspect the original uploaded dataset immediately after a scan.
      */

      setLeaks(detectedLeaks.map((leak, index) => ({ ...leak, dbId: leakRows[index].id })));
      setSelectedAnalysisId(analysis.id);

      setAnalyses((current) => [
        {
          id: analysis.id,
          file_name: file.name,
          total_leakage: totalLeakage,
          estimated_recovery: estimatedRecovery,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);

      setSaved(true);
      return true;
    } catch (err) {
      console.error(err);

      setError(
        "The analysis was completed, but we couldn't save it to your business."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  /* ================================== */
  /* PROCESS ANALYSIS */
  /* ================================== */

  async function processBackgroundAnalysis(
    file: File,
    csvText: string,
    rows: SourceRow[]
  ) {
    const jobId = crypto.randomUUID();

    const safeName =
      file.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, 180) || "analysis.csv";

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "Your session expired. Please sign in again."
      );
    }

    const pathname =
      `analysis-jobs/${user.id}/${jobId}/${safeName}`;

    const uploadFile = new File(
      [csvText],
      safeName,
      { type: "text/csv" }
    );

    await upload(
      pathname,
      uploadFile,
      {
        access: "private",
        handleUploadUrl:
          "/api/analysis-jobs/upload",
        clientPayload:
          JSON.stringify({
            jobId,
            fileName: safeName,
          }),
      }
    );

    const deadline =
      Date.now() + 10 * 60 * 1000;

    while (Date.now() < deadline) {
      const response = await fetch(
        `/api/analysis-jobs/${jobId}`,
        {
          cache: "no-store",
        }
      );

      if (response.status === 404) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
        continue;
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Could not check background analysis."
        );
      }

      const job = payload?.job;

      if (job?.status === "completed") {
        await loadLatestAnalysis();

        // Preserve original source rows in browser memory
        // for the AI Discovery Layer.
        setSourceRows(rows);
        setSaved(true);

        return true;
      }

      if (
        job?.status === "failed" ||
        job?.status === "cancelled"
      ) {
        throw new Error(
          job?.error_message ||
            "Background analysis failed."
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1500)
      );
    }

    throw new Error(
      "Background analysis is still processing. Refresh shortly to load the completed scan."
    );
  }

  async function processAnalysis(file: File, csvText: string, originalRows?: SourceRow[], verifiedResult?: CsvDashboardResult) {
    // Mapping changes detector input only. Discovery retains every original column.
    const rows = originalRows ?? parseSourceRows(csvText);

    const backgroundThresholdBytes =
      3 * 1024 * 1024;

    if (
      !verifiedResult &&
      new Blob([csvText]).size >
        backgroundThresholdBytes
    ) {
      setFileName(file.name);
      setSelectedAnalysisId(null);
      setSaved(false);
      setSelectedLeak(null);
      setSearch("");
      setFilter("All");
      setSourceRows(rows);
      setLeaks([]);
      setAiAnalysis(null);
      setAiError("");
      clearRecoveryAI();
      clearAIDiscovery();

      return await processBackgroundAnalysis(
        file,
        csvText,
        rows
      );
    }

    const response = verifiedResult ?? await requestCsvAnalysis(csvText, { businessName });
    if (originalRows && response.file.rowsBlocked > 0) {
      throw new Error(`${response.file.rowsBlocked} row(s) failed data checks. Correct the file or use the standard import review to inspect excluded rows before analyzing.`);
    }
    const results = toDashboardLeaks(response);
    const prioritized = prioritizeLeaks(results);

    const tracked: TrackedLeak[] = prioritized.map((leak) => ({
      ...leak,
      status: "Open",
      notes: "",
      followUpDate: "",
      contactAttempts: 0,
      lastContactedAt: null,
      recoveredAmount: 0,
      recoveredAt: null,
    }));

    setFileName(file.name);
    setSelectedAnalysisId(null);
    setSaved(false);
    setSelectedLeak(null);
    setSearch("");
    setFilter("All");
    setSourceRows(rows);
    setLeaks(tracked);
    setAiAnalysis(null);
    setAiError("");
    clearRecoveryAI();
    clearAIDiscovery();

    return await saveAnalysis(file, tracked);
  }

  /* ================================== */
  /* FILE UPLOAD */
  /* ================================== */

  async function analyzeMappedFile(file: File, csvText: string, originalRows: SourceRow[]) {
    if (loading || saving || loadingAnalysis || deletingAnalysis || importBusy) {
      throw new Error("Please wait for the current operation to finish before analyzing.");
    }
    setFileName(file.name);
    setError("");
    setSaved(false);
    setSelectedLeak(null);
    setRecoveredAmountInput("");
    setFilter("All");
    setSearch("");
    setImportBusy(true);
    try { return await processAnalysis(file, csvText, originalRows); }
    finally { setImportBusy(false); }
  }

  /* ================================== */
  /* DELETE ANALYSIS */
  /* ================================== */

  async function deleteAnalysis(analysis: AnalysisRecord) {
    if (deletingAnalysis || importBusy) return;

    const confirmed = window.confirm(
      `Delete "${analysis.file_name || "this analysis"}"?\n\nThis will permanently delete the analysis and all of its detected leaks.`
    );

    if (!confirmed) return;

    clearAIDiscovery();
    setDeletingAnalysis(true);
    setError("");

    try {
      const { error: leaksDeleteError } = await supabase
        .from("leaks")
        .delete()
        .eq("analysis_id", analysis.id);

      if (leaksDeleteError) throw leaksDeleteError;

      const { error: analysisDeleteError } = await supabase
        .from("analyses")
        .delete()
        .eq("id", analysis.id);

      if (analysisDeleteError) throw analysisDeleteError;

      if (selectedAnalysisId === analysis.id) {
        setLeaks([]);
        setSourceRows([]);
        setFileName("");
        setSelectedAnalysisId(null);
        setSelectedLeak(null);
        setRecoveredAmountInput("");
        setFilter("All");
        setSearch("");
        setSaved(false);
        setAiAnalysis(null);
        setAiError("");
        clearRecoveryAI();
        clearAIDiscovery();
      }

      await loadLatestAnalysis();
    } catch (err) {
      console.error(err);
      setError("We couldn't delete this analysis.");
    } finally {
      setDeletingAnalysis(false);
    }
  }

  /* ================================== */
  /* LOCAL LEAK UPDATE */
  /* ================================== */

  function updateLocalLeak(
    leak: TrackedLeak,
    updates: Partial<TrackedLeak>
  ) {
    setLeaks((current) =>
      current.map((item) =>
        getLeakKey(item) === getLeakKey(leak)
          ? {
              ...item,
              ...updates,
            }
          : item
      )
    );
  }

  /* ================================== */
  /* RECOVERY WORKSPACE */
  /* ================================== */

  function openRecoveryWorkspace(leak: TrackedLeak) {
    const leakKey = getLeakKey(leak);

    if (selectedLeak === leakKey) {
      setSelectedLeak(null);
      setRecoveredAmountInput("");
      setRecoverySaved(false);
      return;
    }

    setSelectedLeak(leakKey);

    setRecoveredAmountInput(
      leak.recoveredAmount > 0 ? String(leak.recoveredAmount) : ""
    );

    setRecoverySaved(false);
    setError("");

    window.setTimeout(() => {
      document.getElementById(`recovery-${leakKey}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  async function saveRecoveryChanges(leak: TrackedLeak) {
    if (!leak.dbId) {
      setError("This leak has not been saved yet.");
      return;
    }

    const recoveredAmount =
      recoveredAmountInput.trim() === ""
        ? 0
        : Number(recoveredAmountInput);

    if (!Number.isFinite(recoveredAmount) || recoveredAmount < 0) {
      setError("Enter a valid recovered amount.");
      return;
    }

    setSavingRecovery(true);
    setRecoverySaved(false);
    setError("");

    const { error: updateError } = await supabase
      .from("leaks")
      .update({
        notes: leak.notes.trim(),
        follow_up_date: leak.followUpDate || null,
        recovered_amount: recoveredAmount,
      })
      .eq("id", leak.dbId);

    setSavingRecovery(false);

    if (updateError) {
      console.error(updateError);
      setError("We couldn't save the recovery changes.");
      return;
    }

    updateLocalLeak(leak, {
      notes: leak.notes.trim(),
      followUpDate: leak.followUpDate,
      recoveredAmount,
    });

    setRecoveredAmountInput(
      recoveredAmount > 0 ? String(recoveredAmount) : ""
    );

    setRecoverySaved(true);
  }

  async function updateLeakStatus(leak: TrackedLeak, status: LeakStatus) {
    if (!leak.dbId) return;

    setError("");

    const updates: {
      status: LeakStatus;
      recovered_at?: string | null;
    } = {
      status,
    };

    if (status === "Recovered") {
      updates.recovered_at = new Date().toISOString();
    }

    if (status !== "Recovered") {
      updates.recovered_at = null;
    }

    const { error: updateError } = await supabase
      .from("leaks")
      .update(updates)
      .eq("id", leak.dbId);

    if (updateError) {
      console.error(updateError);
      setError("We couldn't save the status change.");
      return;
    }

    updateLocalLeak(leak, {
      status,
      recoveredAt: updates.recovered_at ?? null,
    });

    if (status === "Dismissed" || status === "Recovered") {
      setSelectedLeak(null);
      setRecoveredAmountInput("");
    }
  }

  async function logContactAttempt(leak: TrackedLeak) {
    if (!leak.dbId) return;

    setSavingRecovery(true);
    setRecoverySaved(false);
    setError("");

    const attempts = leak.contactAttempts + 1;
    const contactedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("leaks")
      .update({
        contact_attempts: attempts,
        last_contacted_at: contactedAt,
        status: "Contacted",
      })
      .eq("id", leak.dbId);

    setSavingRecovery(false);

    if (updateError) {
      console.error(updateError);
      setError("We couldn't save the contact attempt.");
      return;
    }

    updateLocalLeak(leak, {
      contactAttempts: attempts,
      lastContactedAt: contactedAt,
      status: "Contacted",
    });
  }

  async function markRecovered(leak: TrackedLeak) {
    if (!leak.dbId) return;

    const recoveredAmount =
      recoveredAmountInput.trim() === ""
        ? 0
        : Number(recoveredAmountInput);

    if (!Number.isFinite(recoveredAmount) || recoveredAmount < 0) {
      setError("Enter a valid recovered amount.");
      return;
    }

    if (recoveredAmount <= 0) {
      setError(
        "Enter the actual recovered amount before marking this leak recovered."
      );
      return;
    }

    setSavingRecovery(true);
    setRecoverySaved(false);
    setError("");

    const recoveredAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("leaks")
      .update({
        status: "Recovered",
        notes: leak.notes.trim(),
        follow_up_date: leak.followUpDate || null,
        recovered_amount: recoveredAmount,
        recovered_at: recoveredAt,
      })
      .eq("id", leak.dbId);

    setSavingRecovery(false);

    if (updateError) {
      console.error(updateError);
      setError("We couldn't mark this leak recovered.");
      return;
    }

    updateLocalLeak(leak, {
      status: "Recovered",
      notes: leak.notes.trim(),
      followUpDate: leak.followUpDate,
      recoveredAmount,
      recoveredAt,
    });

    setSelectedLeak(null);
    setRecoveredAmountInput("");
  }

  /* ================================== */
  /* DASHBOARD CALCULATIONS */
  /* ================================== */

  const openLeaks = useMemo(
    () =>
      leaks.filter(
        (leak) =>
          leak.status !== "Recovered" && leak.status !== "Dismissed"
      ),
    [leaks]
  );

  const recoverableLeaks = useMemo(
    () => openLeaks.filter((leak) => leak.category === "Recoverable"),
    [openLeaks]
  );

  const lostLeaks = useMemo(
    () => openLeaks.filter((leak) => leak.category === "Lost"),
    [openLeaks]
  );

  const totalLeakage = useMemo(
    () =>
      recoverableLeaks.reduce((total, leak) => total + leak.amount, 0),
    [recoverableLeaks]
  );

  const estimatedRecovery = useMemo(
    () =>
      recoverableLeaks.reduce((total, leak) => total + leak.recovery, 0),
    [recoverableLeaks]
  );

  const lostRevenue = useMemo(
    () => lostLeaks.reduce((total, leak) => total + leak.amount, 0),
    [lostLeaks]
  );

  const recoveredAmount = useMemo(
    () =>
      leaks.reduce((total, leak) => total + leak.recoveredAmount, 0),
    [leaks]
  );

  const leadLeaks = openLeaks.filter((leak) =>
    LEAD_TYPES.includes(leak.type)
  );

  const estimateLeaks = openLeaks.filter((leak) =>
    ESTIMATE_TYPES.includes(leak.type)
  );

  const paymentLeaks = openLeaks.filter((leak) =>
    PAYMENT_TYPES.includes(leak.type)
  );

  const jobLeaks = openLeaks.filter((leak) => JOB_TYPES.includes(leak.type));

  const topActions = [...recoverableLeaks]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);

  /* ================================== */
  /* ANALYTICS */
  /* ================================== */

  const allRecoverableLeaks = useMemo(
    () =>
      leaks.filter(
        (leak) =>
          leak.category === "Recoverable" && leak.status !== "Dismissed"
      ),
    [leaks]
  );

  const totalRecoverableOpportunity = useMemo(
    () =>
      allRecoverableLeaks.reduce(
        (total, leak) => total + leak.amount,
        0
      ),
    [allRecoverableLeaks]
  );

  const totalEstimatedOpportunity = useMemo(
    () =>
      allRecoverableLeaks.reduce(
        (total, leak) => total + leak.recovery,
        0
      ),
    [allRecoverableLeaks]
  );

  const recoveryRate =
    totalRecoverableOpportunity > 0
      ? (recoveredAmount / totalRecoverableOpportunity) * 100
      : 0;

  const recoveryProgress =
    totalEstimatedOpportunity > 0
      ? (recoveredAmount / totalEstimatedOpportunity) * 100
      : 0;

  const recoveredLeakCount = leaks.filter(
    (leak) => leak.status === "Recovered"
  ).length;

  const contactedLeakCount = leaks.filter(
    (leak) => leak.status === "Contacted"
  ).length;

  function createBreakdown(
    name: string,
    types: LeakType[]
  ): BreakdownItem {
    const matchingLeaks = openLeaks.filter((leak) =>
      types.includes(leak.type)
    );

    return {
      name,
      count: matchingLeaks.length,
      amount: matchingLeaks.reduce(
        (total, leak) => total + leak.amount,
        0
      ),
      recovery: matchingLeaks
        .filter((leak) => leak.category === "Recoverable")
        .reduce((total, leak) => total + leak.recovery, 0),
    };
  }

  const leakBreakdown: BreakdownItem[] = [
    createBreakdown("Lead", LEAD_TYPES),
    createBreakdown("Estimate", ESTIMATE_TYPES),
    createBreakdown("Payment", PAYMENT_TYPES),
    createBreakdown("Job", JOB_TYPES),
  ];

  const maxBreakdownAmount = Math.max(
    ...leakBreakdown.map((item) => item.amount),
    1
  );

  /* ================================== */
  /* HISTORICAL */
  /* ================================== */

  const historicalAnalyses: HistoricalAnalysis[] = useMemo(
    () =>
      [...analyses].reverse().map((analysis) => ({
        id: analysis.id,
        date: analysis.created_at,
        fileName: analysis.file_name || "Analysis",
        revenueAtRisk: Number(analysis.total_leakage) || 0,
        estimatedRecovery: Number(analysis.estimated_recovery) || 0,
      })),
    [analyses]
  );

  const latestHistoricalAnalysis =
    historicalAnalyses.length > 0
      ? historicalAnalyses[historicalAnalyses.length - 1]
      : null;

  const previousHistoricalAnalysis =
    historicalAnalyses.length > 1
      ? historicalAnalyses[historicalAnalyses.length - 2]
      : null;

  const revenueAtRiskChange =
    latestHistoricalAnalysis && previousHistoricalAnalysis
      ? calculateChange(
          latestHistoricalAnalysis.revenueAtRisk,
          previousHistoricalAnalysis.revenueAtRisk
        )
      : null;

  const estimatedRecoveryChange =
    latestHistoricalAnalysis && previousHistoricalAnalysis
      ? calculateChange(
          latestHistoricalAnalysis.estimatedRecovery,
          previousHistoricalAnalysis.estimatedRecovery
        )
      : null;

  /* ================================== */
  /* FOLLOW UPS */
  /* ================================== */

  const today = getLocalDateString();

  const followUpLeaks = useMemo(
    () =>
      recoverableLeaks
        .filter((leak) => Boolean(leak.followUpDate))
        .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
    [recoverableLeaks]
  );

  const overdueFollowUps = followUpLeaks.filter(
    (leak) => leak.followUpDate < today
  );

  const todayFollowUps = followUpLeaks.filter(
    (leak) => leak.followUpDate === today
  );

  const upcomingFollowUps = followUpLeaks.filter(
    (leak) => leak.followUpDate > today
  );

  const filteredLeaks = openLeaks.filter((leak) => {
    const matchesFilter = filter === "All" || leak.type === filter;

    const matchesSearch = leak.customer
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const latestAnalysisId = analyses.length > 0 ? analyses[0].id : null;

  const viewingLatest = selectedAnalysisId === latestAnalysisId;

  function groupValue(group: TrackedLeak[]) {
    return group.reduce((sum, leak) => sum + leak.amount, 0);
  }

  /* ================================== */
  /* AI ANALYSIS */
  /* ================================== */

  async function runAIDiscovery() {
    if (discoveryRequest.current || loading || loadingAnalysis || deletingAnalysis || saving) return;
    if (sourceRows.length === 0) {
      setDiscoveryError("Upload a fresh CSV or Excel file to run AI Discovery. Saved historical analyses do not include original source rows.");
      return;
    }

    const controller = new AbortController();
    discoveryRequest.current = controller;
    setDiscoveryLoading(true);
    setDiscoveryError("");
    setAiDiscovery(null);
    setDiscoveryMetadata(null);

    try {
      const response = await fetch("/api/ai/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          sourceRows,
          confirmedLeaks: leaks.map((leak) => ({
            customer: leak.customer,
            type: leak.type,
            category: leak.category,
            amount: leak.amount,
            recovery: leak.recovery,
            severity: leak.severity,
            reason: leak.reason,
            action: leak.action,
            daysOpen: leak.daysOpen,
            priorityScore: leak.priorityScore,
            priorityLevel: leak.priorityLevel,
          })),
          fileName,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok || !isAIDiscoveryResponse(data)) {
        throw new Error("AI Discovery couldn't be completed. Please try again.");
      }
      if (discoveryRequest.current !== controller) return;
      setAiDiscovery({ ...data.discovery, discoveryCount: data.discovery.discoveries.length });
      setDiscoveryMetadata(data.metadata);
    } catch {
      if (discoveryRequest.current !== controller || controller.signal.aborted) return;
      setDiscoveryError("AI Discovery couldn't be completed. Please try again.");
    } finally {
      if (discoveryRequest.current === controller) {
        discoveryRequest.current = null;
        setDiscoveryLoading(false);
      }
    }
  }

  async function runAIAnalysis() {
    if (leaks.length === 0) {
      setAiError("There are no detected leaks to analyze.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      let previousScan:
        | {
            revenueAtRisk: number;
            estimatedRecovery: number;
            leakCount: number;
          }
        | undefined;

      if (previousHistoricalAnalysis) {
        previousScan = {
          revenueAtRisk: previousHistoricalAnalysis.revenueAtRisk,
          estimatedRecovery: previousHistoricalAnalysis.estimatedRecovery,
          leakCount: 0,
        };
      }

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          leaks: leaks.map((leak) => ({
            customer: leak.customer,
            type: leak.type,
            category: leak.category,
            amount: leak.amount,
            recovery: leak.recovery,
            severity: leak.severity,
            reason: leak.reason,
            action: leak.action,
            daysOpen: leak.daysOpen,
            priorityScore: leak.priorityScore,
            priorityLevel: leak.priorityLevel,
          })),
          previousScan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "AI analysis failed.");
      }

      if (!data?.analysis) {
        throw new Error("The AI did not return an analysis.");
      }

      setAiAnalysis(data.analysis as AIAnalysis);
    } catch (err) {
      console.error("AI analysis error:", err);

      setAiError(
        err instanceof Error ? err.message : "AI analysis failed."
      );
    } finally {
      setAiLoading(false);
    }
  }

  /* ================================== */
  /* AI RECOVERY ASSISTANT */
  /* ================================== */

  async function runAIRecoveryAssistant(leak: TrackedLeak) {
    const leakKey = getLeakKey(leak);

    setRecoveryAILoadingKey(leakKey);

    setRecoveryAIErrors((current) => ({
      ...current,
      [leakKey]: "",
    }));

    try {
      const response = await fetch("/api/ai/recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          leak: {
            customer: leak.customer,
            type: leak.type,
            category: leak.category,
            amount: leak.amount,
            recovery: leak.recovery,
            severity: leak.severity,
            reason: leak.reason,
            action: leak.action,
            daysOpen: leak.daysOpen,
            priorityScore: leak.priorityScore,
            priorityLevel: leak.priorityLevel,
            status: leak.status,
            notes: leak.notes,
            followUpDate: leak.followUpDate,
            contactAttempts: leak.contactAttempts,
            lastContactedAt: leak.lastContactedAt,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "AI Recovery Assistant failed."
        );
      }

      if (!data?.recoveryPlan) {
        throw new Error(
          "The AI did not return a recovery plan."
        );
      }

      setRecoveryAIPlans((current) => ({
        ...current,
        [leakKey]: data.recoveryPlan as AIRecoveryPlan,
      }));
    } catch (err) {
      console.error("AI recovery assistant error:", err);

      setRecoveryAIErrors((current) => ({
        ...current,
        [leakKey]:
          err instanceof Error
            ? err.message
            : "AI Recovery Assistant failed.",
      }));
    } finally {
      setRecoveryAILoadingKey((current) =>
        current === leakKey ? null : current
      );
    }
  }

  /* ================================== */
  /* RECOVERY UI */
  /* ================================== */

  function renderRecoveryWorkspace(leak: TrackedLeak) {
    const leakKey = getLeakKey(leak);

    if (selectedLeak !== leakKey) {
      return null;
    }

    const recoveryPlan = recoveryAIPlans[leakKey];
    const recoveryAIError = recoveryAIErrors[leakKey];
    const recoveryAILoading = recoveryAILoadingKey === leakKey;

    return (
      <div
        id={`recovery-${leakKey}`}
        className="mt-6 scroll-mt-36 border-t border-slate-800 pt-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <InfoBox title="Why we found it" text={leak.reason} />
          <InfoBox title="Recommended Action" text={leak.action} />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-violet-500/30 bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-800 bg-violet-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest text-violet-400">
                AI RECOVERY ASSISTANT
              </p>

              <h3 className="mt-2 text-lg font-bold">
                Build a recovery plan for this leak.
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                AI uses this leak&apos;s existing information to create
                outreach, follow-up, and recovery guidance.
              </p>
            </div>

            <button
              type="button"
              disabled={recoveryAILoading}
              onClick={() => void runAIRecoveryAssistant(leak)}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recoveryAILoading
                ? "Building Plan..."
                : recoveryPlan
                ? "Generate New Plan"
                : "Generate AI Recovery Plan"}
            </button>
          </div>

          {recoveryAILoading && (
            <div className="p-5">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="font-semibold text-violet-300">
                  Building recovery strategy...
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Creating outreach, messaging, follow-up, and objection
                  handling from the information available for this leak.
                </p>
              </div>
            </div>
          )}

          {recoveryAIError && !recoveryAILoading && (
            <div className="p-5">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="font-semibold text-red-400">
                  Recovery plan couldn&apos;t be generated.
                </p>

                <p className="mt-1 text-sm text-red-300">
                  {recoveryAIError}
                </p>
              </div>
            </div>
          )}

          {recoveryPlan && !recoveryAILoading && (
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold tracking-widest text-violet-400">
                    RECOVERY SUMMARY
                  </p>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      recoveryPlan.confidence === "high"
                        ? "bg-green-500/10 text-green-400"
                        : recoveryPlan.confidence === "medium"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {recoveryPlan.confidence.charAt(0).toUpperCase() +
                      recoveryPlan.confidence.slice(1)}{" "}
                    confidence
                  </span>
                </div>

                <p className="mt-3 text-sm leading-7 text-slate-200">
                  {recoveryPlan.recoverySummary}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <RecoveryAIBox
                  title="Next Best Action"
                  text={recoveryPlan.nextBestAction}
                  blue
                />

                <RecoveryAIBox
                  title="Contact Strategy"
                  text={recoveryPlan.contactStrategy}
                />
              </div>

              <RecoveryAIBox
                title="Customer Message"
                text={recoveryPlan.customerMessage}
                green
              />

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <p className="text-xs font-bold tracking-widest text-blue-400">
                  EMAIL
                </p>

                <p className="mt-3 text-sm font-semibold text-white">
                  Subject: {recoveryPlan.email.subject}
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                  {recoveryPlan.email.body}
                </p>
              </div>

              <RecoveryAIBox
                title="Phone Script"
                text={recoveryPlan.phoneScript}
              />

              {recoveryPlan.objectionHandling.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <p className="text-xs font-bold tracking-widest text-yellow-400">
                    OBJECTION HANDLING
                  </p>

                  <div className="mt-4 space-y-4">
                    {recoveryPlan.objectionHandling.map(
                      (item, index) => (
                        <div
                          key={`${item.objection}-${index}`}
                          className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                        >
                          <p className="font-semibold">
                            {item.objection}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {item.response}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {recoveryPlan.followUpPlan.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <p className="text-xs font-bold tracking-widest text-blue-400">
                    FOLLOW-UP PLAN
                  </p>

                  <div className="mt-4 space-y-3">
                    {recoveryPlan.followUpPlan.map((step, index) => (
                      <div
                        key={`${step.step}-${index}`}
                        className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-sm font-bold text-blue-400">
                          {index + 1}
                        </div>

                        <div>
                          <p className="font-semibold">
                            {step.step}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-blue-400">
                            {step.timing}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {step.action}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recoveryPlan.stopConditions.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                  <p className="text-xs font-bold tracking-widest text-red-400">
                    STOP CONDITIONS
                  </p>

                  <div className="mt-3 space-y-2">
                    {recoveryPlan.stopConditions.map(
                      (condition, index) => (
                        <p
                          key={`${condition}-${index}`}
                          className="text-sm leading-6 text-slate-300"
                        >
                          • {condition}
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-slate-900 p-5">
          <p className="text-xs font-bold tracking-widest text-blue-400">
            RECOVERY WORKSPACE
          </p>

          <h3 className="mt-2 text-lg font-bold">
            Recovery tracking
          </h3>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold">
                Notes
              </label>

              <textarea
                aria-label="Recovery notes"
                value={leak.notes}
                onChange={(event) => {
                  setRecoverySaved(false);

                  updateLocalLeak(leak, {
                    notes: event.target.value,
                  });
                }}
                placeholder="Add call notes, customer response, next steps..."
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">
                Follow-Up Date
              </label>

              <input
                aria-label="Follow-up date"
                type="date"
                value={leak.followUpDate}
                onChange={(event) => {
                  setRecoverySaved(false);

                  updateLocalLeak(leak, {
                    followUpDate: event.target.value,
                  });
                }}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <p className="text-sm font-semibold">
                Contact Attempts
              </p>

              <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-3xl font-bold">
                  {leak.contactAttempts}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Last contacted:{" "}
                  {formatContactDate(leak.lastContactedAt)}
                </p>
              </div>

              <button
                type="button"
                disabled={savingRecovery}
                onClick={() => void logContactAttempt(leak)}
                className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
              >
                +1 Contact Attempt
              </button>
            </div>

            <div>
              <label className="text-sm font-semibold">
                Actual Recovered $
              </label>

              <input
                aria-label="Actual recovered amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={recoveredAmountInput}
                onChange={(event) => {
                  setRecoverySaved(false);
                  setRecoveredAmountInput(event.target.value);
                }}
                placeholder="Enter amount"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-green-500"
              />
            </div>

            <div>
              <p className="text-sm font-semibold">
                Recovery Status
              </p>

              <div className="mt-2 flex min-h-[46px] items-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
                <StatusBadge status={leak.status} />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <button
              type="button"
              disabled={savingRecovery}
              onClick={() => void saveRecoveryChanges(leak)}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50 sm:w-auto"
            >
              {savingRecovery ? "Saving..." : "Save Changes"}
            </button>

            {recoverySaved && (
              <span className="ml-3 text-sm font-medium text-green-400">
                ✓ Changes saved
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={savingRecovery}
              onClick={() => void markRecovered(leak)}
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
            >
              Mark Recovered
            </button>

            <button
              type="button"
              disabled={savingRecovery}
              onClick={() => void updateLeakStatus(leak, "Dismissed")}
              className="rounded-lg border border-red-500/30 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================== */
  /* GENERAL UI HELPERS */
  /* ================================== */

  const hasAnalysis = Boolean(fileName || selectedAnalysisId);

  function startRecovery(leak: TrackedLeak) {
    setActiveTab("Leaks");
    setWorkspaceSource("list");
    setSearch("");
    setFilter("All");

    setSelectedLeak(getLeakKey(leak));

    setRecoveredAmountInput(
      leak.recoveredAmount > 0 ? String(leak.recoveredAmount) : ""
    );

    setRecoverySaved(false);
    setError("");

    window.setTimeout(() => {
      document
        .getElementById(`recovery-${getLeakKey(leak)}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 100);
  }

  /* ================================== */
  /* DATA IMPORT */
  /* ================================== */

  function renderDataImport(compact = false) {
    return (
      <div
        className={`rounded-2xl border border-blue-500/20 bg-slate-900 ${
          compact ? "p-5 sm:p-6" : "p-4 sm:p-6 md:p-8"
        }`}
      >
        <div
          className={
            compact
              ? "flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
              : ""
          }
        >
          <div className={compact ? "" : "text-center"}>
            <p className="text-sm font-bold tracking-widest text-blue-400">
              DATA IMPORT
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Analyze your business
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Upload Excel or CSV business data to scan for
              revenue leaks.
            </p>
          </div>

          <div
            className={`flex flex-col gap-3 sm:flex-row ${
              compact ? "lg:flex-shrink-0" : "mt-7 justify-center"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (compact) {
                  setShowTemplate(true);
                  setActiveTab("Data");
                } else {
                  setShowTemplate(!showTemplate);
                }
              }}
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-7 py-3 font-semibold text-blue-400 transition hover:bg-blue-500/20"
            >
              {!compact && showTemplate
                ? "Hide Template"
                : "View Template"}
            </button>


          </div>
        </div>

        <CsvImportFlow businessName={businessName} onBusyChange={setImportBusy} disabled={loading || saving || loadingAnalysis || deletingAnalysis || importBusy}
          onComplete={(file, csv, result) => processAnalysis(file, csv, undefined, result)} />

        <AIDataMapper onAnalyze={analyzeMappedFile} disabled={loading || saving || loadingAnalysis || deletingAnalysis || importBusy} />

        {!compact && showTemplate && (
          <div className="mt-7 rounded-xl border border-slate-800 bg-slate-950 p-6">
            <h3 className="text-xl font-bold">
              Recommended Columns
            </h3>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {[
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
              ].map((column) => (
                <div
                  key={column}
                  className="rounded-lg bg-slate-900 p-3 text-sm"
                >
                  {column}
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm text-slate-400">
              Older files remain compatible. More completed
              fields allow the detector to use more of the 14
              leak detectors.
            </p>
          </div>
        )}

        {fileName && (
          <div
            className={`rounded-xl border border-slate-800 bg-slate-950 p-4 ${
              compact
                ? "mt-5"
                : "mx-auto mt-6 max-w-xl text-center"
            }`}
          >
            <p className="text-xs text-slate-500">
              Current scan
            </p>

            <p className="mt-1 truncate font-semibold">
              {fileName}
            </p>

            {sourceRows.length > 0 && (
              <p className="mt-1 text-xs text-violet-400">
                {sourceRows.length} source rows ready for AI discovery
              </p>
            )}
          </div>
        )}

        {saving && (
          <p
            className={`mt-4 text-sm text-blue-400 ${
              compact ? "" : "text-center"
            }`}
          >
            Analyzing and saving...
          </p>
        )}

        {saved && !saving && (
          <p
            className={`mt-4 text-sm font-medium text-green-400 ${
              compact ? "" : "text-center"
            }`}
          >
            ✓ Analysis complete and saved
          </p>
        )}
      </div>
    );
  }

  /* ================================== */
  /* 6C BUSINESS SUMMARY */
  /* ================================== */

  function renderBusinessSummary() {
    const summary = aiAnalysis?.businessSummary;

    if (!summary) return null;

    const healthStyles =
      summary.healthStatus === "critical"
        ? "border-red-500/30 bg-red-500/10 text-red-400"
        : summary.healthStatus === "attention"
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
        : "border-green-500/30 bg-green-500/10 text-green-400";

    const healthLabel =
      summary.healthStatus === "critical"
        ? "Critical"
        : summary.healthStatus === "attention"
        ? "Needs Attention"
        : "Stable";

    const trendStyles =
      summary.trendDirection === "improving"
        ? "bg-green-500/10 text-green-400"
        : summary.trendDirection === "worsening"
        ? "bg-red-500/10 text-red-400"
        : summary.trendDirection === "stable"
        ? "bg-blue-500/10 text-blue-400"
        : "bg-slate-800 text-slate-400";

    const trendLabel =
      summary.trendDirection === "improving"
        ? "Improving"
        : summary.trendDirection === "worsening"
        ? "Worsening"
        : summary.trendDirection === "stable"
        ? "Stable"
        : "No Trend Yet";

    return (
      <section className="mt-6 overflow-hidden rounded-2xl border border-violet-500/30 bg-slate-900">
        <div className="border-b border-slate-800 bg-gradient-to-r from-violet-500/10 via-blue-500/5 to-transparent p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold tracking-widest text-violet-400">
                AI BUSINESS SUMMARY
              </p>

              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                {summary.headline}
              </h2>

              <p className="mt-3 leading-7 text-slate-300">
                {summary.overview}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${healthStyles}`}
              >
                {healthLabel}
              </span>

              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${trendStyles}`}
              >
                Trend: {trendLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <p className="text-xs font-bold tracking-widest text-blue-400">
                PRIORITY FOCUS
              </p>

              <p className="mt-3 text-lg font-bold">
                {summary.priorityFocus}
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="text-xs font-bold tracking-widest text-red-400">
                BIGGEST LEAK AREA
              </p>

              <p className="mt-3 text-lg font-bold">
                {summary.biggestLeakArea}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-xs font-bold tracking-widest text-slate-400">
                CURRENT EXPOSURE
              </p>

              <p className="mt-3 text-2xl font-bold">
                ${formatMoney(totalLeakage)}
              </p>

              <p className="mt-1 text-sm text-green-400">
                ${formatMoney(estimatedRecovery)} potentially
                recoverable
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-xs font-bold tracking-widest text-slate-400">
                WHY THIS AREA MATTERS
              </p>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {summary.biggestLeakExplanation}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <p className="text-xs font-bold tracking-widest text-slate-400">
                TREND
              </p>

              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${trendStyles}`}
                >
                  {trendLabel}
                </span>
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {summary.trendExplanation}
              </p>
            </div>
          </div>

          {summary.ownerFocus.length > 0 && (
            <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
              <p className="text-xs font-bold tracking-widest text-violet-400">
                WHAT TO FOCUS ON NOW
              </p>

              <div className="mt-4 space-y-3">
                {summary.ownerFocus.map((focus, index) => (
                  <div
                    key={`${focus}-${index}`}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-400">
                      {index + 1}
                    </div>

                    <p className="pt-0.5 text-sm leading-6 text-slate-200">
                      {focus}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ================================== */
  /* AI ANALYST */
  /* ================================== */

  function renderAIAnalysis() {
    return (
      <>
        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold tracking-widest text-violet-400">
                AI BUSINESS ANALYST
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Understand what&apos;s causing your revenue leaks.
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                AI reviews the opportunities found by the
                detection engine, identifies patterns, and
                recommends what to address first.
              </p>
            </div>

            <button
              type="button"
              disabled={aiLoading || leaks.length === 0}
              onClick={() => void runAIAnalysis()}
              className="rounded-xl bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading
                ? "Analyzing..."
                : aiAnalysis
                ? "Run Again"
                : "Analyze With AI"}
            </button>
          </div>

          {aiLoading && (
            <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
              <p className="font-semibold text-violet-300">
                AI is analyzing your business...
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Reviewing detected leaks, priorities, recovery
                potential, patterns, and historical movement.
              </p>
            </div>
          )}

          {aiError && !aiLoading && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="font-semibold text-red-400">
                AI analysis couldn&apos;t be completed.
              </p>

              <p className="mt-1 text-sm text-red-300">
                {aiError}
              </p>
            </div>
          )}

          {aiAnalysis && !aiLoading && (
            <div className="mt-7 space-y-5">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold tracking-widest text-violet-400">
                    EXECUTIVE SUMMARY
                  </p>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      aiAnalysis.confidence === "high"
                        ? "bg-green-500/10 text-green-400"
                        : aiAnalysis.confidence === "medium"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {aiAnalysis.confidence.charAt(0).toUpperCase() +
                      aiAnalysis.confidence.slice(1)}{" "}
                    confidence
                  </span>
                </div>

                <p className="mt-3 leading-7 text-slate-200">
                  {aiAnalysis.executiveSummary}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <p className="text-xs font-bold tracking-widest text-slate-400">
                    LIKELY ROOT CAUSE
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    {aiAnalysis.rootCause}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
                  <p className="text-xs font-bold tracking-widest text-blue-400">
                    HIGHEST PRIORITY ACTION
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    {aiAnalysis.highestPriorityAction}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                <p className="text-xs font-bold tracking-widest text-green-400">
                  RECOVERY STRATEGY
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-200">
                  {aiAnalysis.recoveryStrategy}
                </p>
              </div>

              {aiAnalysis.insights.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold">
                    AI Insights
                  </h3>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {aiAnalysis.insights.map((insight, index) => (
                      <div
                        key={`${insight.title}-${index}`}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-sm font-bold text-violet-400">
                            {index + 1}
                          </div>

                          <div>
                            <h4 className="font-semibold">
                              {insight.title}
                            </h4>

                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {insight.explanation}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-slate-800 pt-4">
                          <p className="text-xs font-bold tracking-wider text-blue-400">
                            RECOMMENDED ACTION
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {insight.recommendedAction}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {aiAnalysis && !aiLoading && renderBusinessSummary()}
      </>
    );
  }

  /* ================================== */
  /* PAGE */
  /* ================================== */

  return (
    <main className="min-h-screen bg-slate-950 text-white [overflow-wrap:anywhere]">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 pb-4">
            <p className="text-xs font-bold tracking-widest text-blue-400 sm:text-sm">
              BUSINESS LEAK DETECTOR
            </p>

            <p className="max-w-[45%] truncate text-sm text-slate-300">
              {businessName || "Your business"}
            </p>
          </div>

          <nav
            aria-label="Main navigation"
            className="grid grid-cols-5 gap-1"
          >
            {(
              ["Dashboard", "Leaks", "Analytics", "Data"] as const
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-current={activeTab === tab ? "page" : undefined}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-1 py-3 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? "border-blue-400 text-blue-300"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          <a
            href="/reports"
            className="border-b-2 border-transparent px-1 py-3 text-center text-sm font-semibold text-slate-400 transition-colors hover:text-white"
          >
            Reports
          </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {activeTab}
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          {
            {
              Dashboard:
                "Analyze your business, see what needs attention, and take the next step.",
              Leaks:
                "Work your opportunities and keep every follow-up on track.",
              Analytics:
                "See your recovery results and how scans change over time.",
              Data:
                "Manage templates and your saved scans.",
            }[activeTab]
          }
        </p>

        {(loading || loadingAnalysis || deletingAnalysis) && (
          <p className="mt-6 rounded-xl bg-slate-900 p-5 text-slate-300">
            {loading
              ? "Loading your business data…"
              : loadingAnalysis
              ? "Loading analysis…"
              : "Deleting analysis…"}
          </p>
        )}

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-red-300">
            {error}
          </p>
        )}

        {!loading &&
          businessId &&
          selectedAnalysisId &&
          !viewingLatest && (
            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-yellow-400">
                  Viewing a previous analysis
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Dashboard data is from {fileName}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadAnalysis(analyses[0])}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold"
              >
                Latest Analysis
              </button>
            </div>
          )}

        {/* DASHBOARD */}

        {!loading && businessId && activeTab === "Dashboard" && (
          <section>
            <div className="mt-6">
              {renderDataImport(true)}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-violet-500/30 bg-slate-900" aria-busy={discoveryLoading}>
              <div className="flex flex-col gap-4 border-b border-slate-800 bg-violet-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest text-violet-400">AI DISCOVERY</p>
                  <h2 className="mt-2 text-xl font-bold">Potential AI Discoveries</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Explore additional patterns in your original business data. These AI-discovered findings require human review and are not confirmed leaks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runAIDiscovery()}
                  disabled={sourceRows.length === 0 || discoveryLoading || loadingAnalysis || deletingAnalysis || saving}
                  aria-describedby="discovery-availability"
                  className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {discoveryLoading ? "Discovering Patterns..." : aiDiscovery ? "Run Discovery Again" : "Run AI Discovery"}
                </button>
              </div>
              <div className="space-y-5 p-5">
                <p id="discovery-availability" className="text-sm leading-6 text-slate-400">
                  {sourceRows.length === 0
                    ? "AI Discovery needs original source rows. Saved historical analyses currently do not retain those rows. Upload a fresh CSV or Excel file to enable discovery."
                    : `${sourceRows.length.toLocaleString()} original source rows available from ${fileName}. Potential findings do not change confirmed leak counts, revenue totals, or recovery tracking.`}
                </p>
                {discoveryLoading && (
                  <div role="status" className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <p className="font-semibold text-violet-300">Reviewing your original business data...</p>
                    <p className="mt-1 text-sm text-slate-400">Looking for evidence-backed patterns beyond the confirmed deterministic leaks.</p>
                  </div>
                )}
                {discoveryError && (
                  <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{discoveryError}</p>
                )}
                {!aiDiscovery && !discoveryLoading && !discoveryError && sourceRows.length > 0 && (
                  <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                    Ready to explore potential workflow gaps, customer patterns, revenue opportunities, and data-quality issues. A review may return zero discoveries.
                  </p>
                )}
                {aiDiscovery && !discoveryLoading && (
                  <>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-bold tracking-widest text-violet-400">DISCOVERY SUMMARY</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">{aiDiscovery.discoveryCount} potential discoveries</span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">Overall confidence: {aiDiscovery.overallConfidence}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-200">{aiDiscovery.summary}</p>
                      {discoveryMetadata && (
                        <p className="mt-3 text-xs leading-5 text-slate-400">
                          {discoveryMetadata.rowsAnalyzed.toLocaleString()} source rows reviewed · {discoveryMetadata.confirmedLeaksProvided.toLocaleString()} confirmed leaks supplied for comparison.
                          {discoveryMetadata.rowsLimited && " Only the first 500 source rows were reviewed because of the current analysis limit."}
                        </p>
                      )}
                    </div>
                    <p className="text-xs leading-5 text-amber-300">Potential findings only — not confirmed leaks. Estimated impact is not guaranteed recoverable revenue and is excluded from dashboard totals.</p>
                    {aiDiscovery.discoveries.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <p className="font-semibold">No additional potential discoveries returned.</p>
                        <p className="mt-2 text-sm text-slate-400">This review did not identify further evidence-backed patterns. Your confirmed leak analysis remains available.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {aiDiscovery.discoveries.map((item, index) => (
                          <article key={`${item.title}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                            <p className="text-xs font-bold tracking-widest text-violet-400">POTENTIAL · AI-DISCOVERED</p>
                            <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{item.category}</span>
                              <span className={`rounded-full px-3 py-1 ${item.priority === "Critical" || item.priority === "High" ? "bg-red-500/10 text-red-400" : item.priority === "Medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-slate-800 text-slate-400"}`}>{item.priority} priority</span>
                              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-violet-300">Confidence: {item.confidence}</span>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-slate-300">{item.description}</p>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                              <p>Affected records: <span className="font-semibold text-slate-200">{item.affectedRecords.toLocaleString()}</span></p>
                              {item.estimatedImpact > 0 && <p>Estimated potential impact: <span className="font-semibold text-amber-300">${formatMoney(item.estimatedImpact)}</span></p>}
                            </div>
                            <div className="mt-5 border-t border-slate-800 pt-4">
                              <p className="text-xs font-bold tracking-widest text-slate-400">EVIDENCE</p>
                              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                                {item.evidence.map((entry, evidenceIndex) => <li key={evidenceIndex}>{entry}</li>)}
                              </ul>
                            </div>
                            <div className="mt-4 space-y-4">
                              <InfoBox title="Recommended Review" text={item.recommendedReview} />
                              <InfoBox title="Recommended Action" text={item.recommendedAction} />
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {!hasAnalysis ? (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-10">
                <h2 className="text-2xl font-bold">
                  Find your first recovery opportunity.
                </h2>

                <p className="mt-3 max-w-xl text-slate-400">
                  Upload your business data above. We&apos;ll
                  scan it for revenue leaks and show you where
                  to start.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <MetricCard
                    title="Revenue at Risk"
                    value={`$${formatMoney(totalLeakage)}`}
                    description="Open recoverable revenue"
                  />

                  <MetricCard
                    title="Potentially Recoverable"
                    value={`$${formatMoney(estimatedRecovery)}`}
                    description="Estimated recovery from open opportunities"
                    green
                  />

                  <MetricCard
                    title="Recovered"
                    value={`$${formatMoney(recoveredAmount)}`}
                    description="Actual recovery recorded for this scan"
                    green
                  />
                </div>

                {leaks.length > 0 && renderAIAnalysis()}

                <div className="mt-6 rounded-2xl border border-blue-500/20 bg-slate-900 p-6 sm:p-8">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setActiveTab("Leaks")}
                      className="rounded-lg bg-red-500/10 px-4 py-2 text-red-300"
                    >
                      {overdueFollowUps.length} overdue
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("Leaks")}
                      className="rounded-lg bg-amber-500/10 px-4 py-2 text-amber-300"
                    >
                      {todayFollowUps.length} due today
                    </button>
                  </div>

                  <h2 className="mt-5 text-2xl font-bold">
                    {topActions.length
                      ? "Your next recovery starts here."
                      : "No open recoverable opportunities."}
                  </h2>

                  <p className="mt-2 text-slate-400">
                    {topActions.length
                      ? "Start with your highest-priority opportunity, then record the outcome."
                      : "Upload a fresh scan to check for new opportunities."}
                  </p>

                  <button
                    type="button"
                    disabled={
                      loadingAnalysis || savingRecovery || saving
                    }
                    onClick={() =>
                      topActions[0]
                        ? startRecovery(topActions[0])
                        : undefined
                    }
                    className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold hover:bg-blue-500 disabled:opacity-50 sm:w-auto"
                  >
                    {topActions.length
                      ? "Start Recovering Revenue →"
                      : "No Recovery Work Needed"}
                  </button>
                </div>

                {topActions.length > 0 && (
                  <section className="mt-8">
                    <h2 className="text-xl font-bold">
                      Top 3 opportunities
                    </h2>

                    <div className="mt-4 space-y-3">
                      {topActions.map((leak, index) => (
                        <div
                          key={getLeakKey(leak)}
                          className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold">
                              {index + 1}. {leak.customer}
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                              {leak.type}
                            </p>

                            <div className="mt-2">
                              <PriorityBadge
                                level={leak.priorityLevel}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <p className="text-sm text-green-400">
                              ~${formatMoney(leak.recovery)}{" "}
                              recoverable
                            </p>

                            <button
                              type="button"
                              onClick={() => startRecovery(leak)}
                              className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold"
                            >
                              Start recovery
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </section>
        )}

        {/* LEAKS */}

        {activeTab === "Leaks" && (
          <section>
            {!loading && businessId && leaks.length > 0 && (
              <>
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <p className="text-sm font-bold tracking-widest text-blue-400">
                    FOLLOW-UP QUEUE
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Today&apos;s recovery work.
                  </h2>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <FollowUpCount
                      title="Overdue"
                      count={overdueFollowUps.length}
                      red
                    />

                    <FollowUpCount
                      title="Today"
                      count={todayFollowUps.length}
                      yellow
                    />

                    <FollowUpCount
                      title="Upcoming"
                      count={upcomingFollowUps.length}
                    />
                  </div>

                  <div className="mt-7 space-y-6">
                    {overdueFollowUps.length > 0 && (
                      <FollowUpSection
                        title="Overdue"
                        description="These follow-ups have passed their scheduled date."
                        leaks={overdueFollowUps}
                        group="Overdue"
                        selectedLeak={
                          workspaceSource === "queue"
                            ? selectedLeak
                            : null
                        }
                        onOpen={(leak) => {
                          setWorkspaceSource("queue");
                          openRecoveryWorkspace(leak);
                        }}
                        renderWorkspace={(leak) =>
                          workspaceSource === "queue"
                            ? renderRecoveryWorkspace(leak)
                            : null
                        }
                      />
                    )}

                    {todayFollowUps.length > 0 && (
                      <FollowUpSection
                        title="Due Today"
                        description="These recovery opportunities need attention today."
                        leaks={todayFollowUps}
                        group="Today"
                        selectedLeak={
                          workspaceSource === "queue"
                            ? selectedLeak
                            : null
                        }
                        onOpen={(leak) => {
                          setWorkspaceSource("queue");
                          openRecoveryWorkspace(leak);
                        }}
                        renderWorkspace={(leak) =>
                          workspaceSource === "queue"
                            ? renderRecoveryWorkspace(leak)
                            : null
                        }
                      />
                    )}

                    {upcomingFollowUps.length > 0 && (
                      <FollowUpSection
                        title="Upcoming"
                        description="Scheduled recovery work coming up next."
                        leaks={upcomingFollowUps}
                        group="Upcoming"
                        selectedLeak={
                          workspaceSource === "queue"
                            ? selectedLeak
                            : null
                        }
                        onOpen={(leak) => {
                          setWorkspaceSource("queue");
                          openRecoveryWorkspace(leak);
                        }}
                        renderWorkspace={(leak) =>
                          workspaceSource === "queue"
                            ? renderRecoveryWorkspace(leak)
                            : null
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <h2 className="text-2xl font-semibold">
                    All Open Leaks
                  </h2>

                  <div className="mt-6 flex flex-col gap-3 md:flex-row">
                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search customer..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                    />

                    <select
                      value={filter}
                      onChange={(event) =>
                        setFilter(
                          event.target.value as "All" | LeakType
                        )
                      }
                      className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                    >
                      <option value="All">
                        All Leak Types
                      </option>

                      {LEAK_TYPES.map((type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-6 space-y-4">
                    {filteredLeaks.map((leak) => (
                      <div
                        key={getLeakKey(leak)}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-blue-400">
                                {leak.type}
                              </p>

                              <PriorityBadge
                                level={leak.priorityLevel}
                              />

                              <CategoryBadge
                                category={leak.category}
                              />

                              <StatusBadge
                                status={leak.status}
                              />
                            </div>

                            <h3 className="mt-2 text-xl font-semibold">
                              {leak.customer}
                            </h3>
                          </div>

                          <div className="md:text-right">
                            <p className="text-2xl font-bold">
                              ${formatMoney(leak.amount)}
                            </p>

                            {leak.category === "Recoverable" ? (
                              <p className="mt-1 text-sm text-green-400">
                                ~${formatMoney(leak.recovery)}{" "}
                                estimated recovery
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-red-400">
                                Revenue lost
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setWorkspaceSource("list");
                            openRecoveryWorkspace(leak);
                          }}
                          className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold"
                        >
                          {workspaceSource === "list" &&
                          selectedLeak === getLeakKey(leak)
                            ? "Close Workspace"
                            : "Open Recovery Workspace"}
                        </button>

                        {workspaceSource === "list" &&
                          renderRecoveryWorkspace(leak)}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!loading && businessId && leaks.length === 0 && (
              <p className="mt-6 rounded-xl bg-slate-900 p-6 text-slate-400">
                No leaks to display.
              </p>
            )}
          </section>
        )}

        {/* ANALYTICS */}

        {activeTab === "Analytics" && (
          <section>
            {!loading && businessId && leaks.length > 0 && (
              <>
                <div className="mt-6 rounded-2xl border border-blue-500/20 bg-slate-900 p-6">
                  <p className="text-sm font-bold tracking-widest text-blue-400">
                    ANALYTICS
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Recovery performance
                  </h2>

                  <div className="mt-7 grid gap-5 lg:grid-cols-2">
                    <AnalyticsProgressCard
                      title="Recovery Rate"
                      percentage={recoveryRate}
                      current={recoveredAmount}
                      target={totalRecoverableOpportunity}
                      currentLabel="Recovered"
                      targetLabel="Total recoverable opportunity"
                    />

                    <AnalyticsProgressCard
                      title="Recovery Progress"
                      percentage={recoveryProgress}
                      current={recoveredAmount}
                      target={totalEstimatedOpportunity}
                      currentLabel="Actually recovered"
                      targetLabel="Estimated recovery"
                    />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <AnalyticsMiniCard
                      title="Recoverable Opportunity"
                      value={`$${formatMoney(
                        totalRecoverableOpportunity
                      )}`}
                    />

                    <AnalyticsMiniCard
                      title="Estimated Recovery"
                      value={`$${formatMoney(
                        totalEstimatedOpportunity
                      )}`}
                    />

                    <AnalyticsMiniCard
                      title="Recovered Leaks"
                      value={String(recoveredLeakCount)}
                    />

                    <AnalyticsMiniCard
                      title="Currently Contacted"
                      value={String(contactedLeakCount)}
                    />
                  </div>

                  <div className="mt-8">
                    <h3 className="text-xl font-bold">
                      Leak Breakdown
                    </h3>

                    <div className="mt-5 space-y-4">
                      {leakBreakdown.map((item) => {
                        const width =
                          item.amount > 0
                            ? Math.max(
                                4,
                                (item.amount / maxBreakdownAmount) *
                                  100
                              )
                            : 0;

                        return (
                          <div
                            key={item.name}
                            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                          >
                            <div className="flex justify-between gap-4">
                              <div>
                                <p className="font-semibold">
                                  {item.name} Leaks
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {item.count} open
                                </p>
                              </div>

                              <p className="font-bold">
                                ${formatMoney(item.amount)}
                              </p>
                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${width}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {analyses.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <p className="text-sm font-bold tracking-widest text-blue-400">
                      HISTORICAL TRENDS
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      Track leaks between scans.
                    </h2>

                    {previousHistoricalAnalysis && (
                      <div className="mt-7 grid gap-5 lg:grid-cols-2">
                        <TrendSummaryCard
                          title="Revenue at Risk"
                          current={
                            latestHistoricalAnalysis?.revenueAtRisk ||
                            0
                          }
                          previous={
                            previousHistoricalAnalysis.revenueAtRisk
                          }
                          change={revenueAtRiskChange}
                        />

                        <TrendSummaryCard
                          neutral
                          title="Estimated Recovery"
                          current={
                            latestHistoricalAnalysis?.estimatedRecovery ||
                            0
                          }
                          previous={
                            previousHistoricalAnalysis.estimatedRecovery
                          }
                          change={estimatedRecoveryChange}
                        />
                      </div>
                    )}

                    <div className="mt-8 grid gap-6 xl:grid-cols-2">
                      <TrendChart
                        title="Revenue at Risk Over Time"
                        description="Recoverable revenue detected in each scan."
                        analyses={historicalAnalyses}
                        valueKey="revenueAtRisk"
                      />

                      <TrendChart
                        title="Estimated Recovery Over Time"
                        description="Estimated recoverable value detected in each scan."
                        analyses={historicalAnalyses}
                        valueKey="estimatedRecovery"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 grid gap-5 md:grid-cols-4">
                  <CategoryCard
                    title="Lead Leaks"
                    count={leadLeaks.length}
                    value={groupValue(leadLeaks)}
                    description="Lead opportunities"
                  />

                  <CategoryCard
                    title="Estimate Leaks"
                    count={estimateLeaks.length}
                    value={groupValue(estimateLeaks)}
                    description="Estimate opportunities"
                  />

                  <CategoryCard
                    title="Payment Leaks"
                    count={paymentLeaks.length}
                    value={groupValue(paymentLeaks)}
                    description="Uncollected payments"
                  />

                  <CategoryCard
                    title="Job Leaks"
                    count={jobLeaks.length}
                    value={groupValue(jobLeaks)}
                    description="No-shows and cancellations"
                  />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <MetricCard
                    title="Revenue Lost"
                    value={`$${formatMoney(lostRevenue)}`}
                    description="Detected revenue already lost"
                    red
                  />

                  <MetricCard
                    title="Open Leaks"
                    value={String(openLeaks.length)}
                    description="Issues requiring review"
                  />
                </div>
              </>
            )}
          </section>
        )}

        {/* DATA */}

        {activeTab === "Data" && (
          <section>
            {!loading && businessId && (
              <div className="mt-6">
                {renderDataImport(false)}
              </div>
            )}

            {!loading && businessId && analyses.length > 0 && (
              <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex w-full items-center justify-between p-6 text-left"
                >
                  <div>
                    <p className="text-sm font-bold tracking-widest text-blue-400">
                      ANALYSIS HISTORY
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      Previous scans
                    </h2>
                  </div>

                  <span className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold">
                    {showHistory ? "Hide History" : "View History"}
                  </span>
                </button>

                {showHistory && (
                  <div className="border-t border-slate-800 p-6">
                    <div className="space-y-3">
                      {analyses.map((analysis, index) => {
                        const isSelected =
                          selectedAnalysisId === analysis.id;

                        return (
                          <div
                            key={analysis.id}
                            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <h3 className="font-semibold">
                                  {analysis.file_name ||
                                    "Saved analysis"}
                                </h3>

                                <p className="mt-2 text-sm text-slate-400">
                                  {formatAnalysisDate(
                                    analysis.created_at
                                  )}
                                </p>

                                {index === 0 && (
                                  <span className="mt-2 inline-block rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-400">
                                    Latest
                                  </span>
                                )}
                              </div>

                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  disabled={isSelected}
                                  onClick={() =>
                                    void loadAnalysis(analysis)
                                  }
                                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:bg-slate-800"
                                >
                                  {isSelected
                                    ? "Currently Viewing"
                                    : "View Analysis"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteAnalysis(analysis)
                                  }
                                  className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

/* ================================== */
/* COMPONENTS */
/* ================================== */

function RecoveryAIBox({
  title,
  text,
  blue = false,
  green = false,
}: {
  title: string;
  text: string;
  blue?: boolean;
  green?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        green
          ? "border-green-500/20 bg-green-500/5"
          : blue
          ? "border-blue-500/20 bg-blue-500/5"
          : "border-slate-800 bg-slate-950"
      }`}
    >
      <p
        className={`text-xs font-bold tracking-widest ${
          green
            ? "text-green-400"
            : blue
            ? "text-blue-400"
            : "text-slate-400"
        }`}
      >
        {title.toUpperCase()}
      </p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
        {text}
      </p>
    </div>
  );
}

function TrendSummaryCard({
  title,
  current,
  previous,
  change,
  neutral = false,
}: {
  title: string;
  current: number;
  previous: number;
  change: {
    amount: number;
    percent: number | null;
  } | null;
  neutral?: boolean;
}) {
  const amount = change?.amount || 0;
  const isDown = amount < 0;
  const isUp = amount > 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-3 text-3xl font-bold">
        ${formatMoney(current)}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            neutral && (isDown || isUp)
              ? "bg-blue-500/10 text-blue-400"
              : isDown
              ? "bg-green-500/10 text-green-400"
              : isUp
              ? "bg-red-500/10 text-red-400"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {isDown ? "↓" : isUp ? "↑" : "—"} $
          {formatMoney(Math.abs(amount))}
        </span>

        <span className="text-xs text-slate-400">
          vs. previous scan
        </span>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Previous: ${formatMoney(previous)}
      </p>
    </div>
  );
}

function TrendChart({
  title,
  description,
  analyses,
  valueKey,
}: {
  title: string;
  description: string;
  analyses: HistoricalAnalysis[];
  valueKey: "revenueAtRisk" | "estimatedRecovery";
}) {
  const values = analyses.map((analysis) => analysis[valueKey]);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
      <h3 className="font-bold">{title}</h3>

      <p className="mt-1 text-sm text-slate-400">
        {description}
      </p>

      <div className="mt-8 flex h-64 items-end gap-3 overflow-x-auto">
        {analyses.map((analysis) => {
          const value = analysis[valueKey];

          const height =
            value > 0
              ? Math.max(8, (value / maxValue) * 100)
              : 2;

          return (
            <div
              key={analysis.id}
              className="flex h-full min-w-[65px] flex-1 flex-col items-center justify-end"
            >
              <p className="mb-2 text-xs font-semibold">
                ${formatMoney(value)}
              </p>

              <div className="flex h-44 w-full items-end">
                <div
                  className="w-full rounded-t-lg bg-blue-500"
                  style={{
                    height: `${height}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-xs text-slate-400">
                {formatShortDate(analysis.date)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsProgressCard({
  title,
  percentage,
  current,
  target,
  currentLabel,
  targetLabel,
}: {
  title: string;
  percentage: number;
  current: number;
  target: number;
  currentLabel: string;
  targetLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-2 text-4xl font-bold text-green-400">
        {formatPercent(percentage)}
      </p>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-green-500"
          style={{
            width: `${clampPercent(percentage)}%`,
          }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-400">{currentLabel}</p>

          <p className="font-semibold">
            ${formatMoney(current)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-slate-400">{targetLabel}</p>

          <p className="font-semibold">
            ${formatMoney(target)}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnalyticsMiniCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function FollowUpCount({
  title,
  count,
  red = false,
  yellow = false,
}: {
  title: string;
  count: number;
  red?: boolean;
  yellow?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
      <p
        className={`text-2xl font-bold ${
          red
            ? "text-red-400"
            : yellow
            ? "text-yellow-400"
            : "text-blue-400"
        }`}
      >
        {count}
      </p>

      <p className="text-xs text-slate-400">{title}</p>
    </div>
  );
}

function FollowUpSection({
  title,
  description,
  leaks,
  group,
  selectedLeak,
  onOpen,
  renderWorkspace,
}: {
  title: string;
  description: string;
  leaks: TrackedLeak[];
  group: FollowUpGroup;
  selectedLeak: string | null;
  onOpen: (leak: TrackedLeak) => void;
  renderWorkspace: (leak: TrackedLeak) => React.ReactNode;
}) {
  return (
    <div>
      <h3
        className={`text-lg font-bold ${
          group === "Overdue"
            ? "text-red-400"
            : group === "Today"
            ? "text-yellow-400"
            : "text-blue-400"
        }`}
      >
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        {description}
      </p>

      <div className="mt-3 space-y-3">
        {leaks.map((leak) => (
          <div
            key={getLeakKey(leak)}
            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{leak.customer}</p>

                <p className="mt-1 text-sm text-slate-400">
                  {leak.type} •{" "}
                  {formatFollowUpDate(leak.followUpDate)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpen(leak)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold"
              >
                {selectedLeak === getLeakKey(leak)
                  ? "Close Recovery"
                  : "Open Recovery"}
              </button>
            </div>

            {renderWorkspace(leak)}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  green = false,
  red = false,
}: {
  title: string;
  value: string;
  description: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-7">
      <p className="text-sm text-slate-400">{title}</p>

      <h2
        className={`mt-3 text-4xl font-bold ${
          green
            ? "text-green-400"
            : red
            ? "text-red-400"
            : ""
        }`}
      >
        {value}
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>
    </div>
  );
}

function CategoryCard({
  title,
  count,
  value,
  description,
}: {
  title: string;
  count: number;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-slate-400">{title}</p>

      <div className="mt-3 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-bold">{count}</h2>

        <p className="font-semibold">
          ${formatMoney(value)}
        </p>
      </div>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>
    </div>
  );
}

function PriorityBadge({
  level,
}: {
  level: "Critical" | "High" | "Medium";
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        level === "Critical"
          ? "bg-red-500/10 text-red-400"
          : level === "High"
          ? "bg-yellow-500/10 text-yellow-400"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      {level}
    </span>
  );
}

function CategoryBadge({
  category,
}: {
  category: LeakCategory;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        category === "Lost"
          ? "bg-red-500/10 text-red-400"
          : "bg-green-500/10 text-green-400"
      }`}
    >
      {category}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: LeakStatus;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "Recovered"
          ? "bg-green-500/10 text-green-400"
          : status === "Contacted"
          ? "bg-blue-500/10 text-blue-400"
          : status === "Dismissed"
          ? "bg-red-500/10 text-red-400"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

function InfoBox({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-sm text-slate-300">
        {text}
      </p>
    </div>
  );
}
/* AI suggests column mappings only; approved data goes through the deterministic engine. */
const MAPPER_FIELDS = [
  "Customer Name", "Status", "Quote Amount", "Invoice Amount", "Follow Up",
  "Date", "Last Contact Date", "Due Date", "Payment Status", "Contacted",
  "Estimate Sent", "Expiration Date", "Amount Paid", "Appointment Status",
  "Job Status", "Job Amount", "Unmapped",
] as const;

type MapperProposal = {
  summary: string;
  overallConfidence: "low" | "medium" | "high";
  mappings: {
    sourceColumn: string;
    standardField: string;
    confidence: "low" | "medium" | "high";
    reviewRequired: boolean;
    reason: string;
  }[];
  duplicateWarnings: string[];
  dataQualityWarnings: string[];
  unmappedColumns: string[];
};

function validateMapperProposal(value: unknown, columns: string[]): MapperProposal {
  if (!value || typeof value !== "object") throw new Error("Invalid mapping response. Please try again.");
  const p = value as MapperProposal;
  const confidence = (v: unknown) => v === "low" || v === "medium" || v === "high";
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
  if (typeof p.summary !== "string" || !confidence(p.overallConfidence) ||
      !Array.isArray(p.mappings) || !strings(p.duplicateWarnings) ||
      !strings(p.dataQualityWarnings) || !strings(p.unmappedColumns) ||
      p.mappings.length !== columns.length ||
      new Set(p.mappings.map(m => m?.sourceColumn)).size !== columns.length ||
      p.mappings.some(m => !m || !columns.includes(m.sourceColumn) ||
        !MAPPER_FIELDS.some(field => field === m.standardField) || !confidence(m.confidence) ||
        typeof m.reviewRequired !== "boolean" || typeof m.reason !== "string")) {
    throw new Error("The mapper returned an incomplete or invalid proposal. Please try again.");
  }
  return p;
}

// Adapter boundary: preserve source records; only approved, validated fields reach CSV.
const MAPPER_LIMITS = { bytes: 10 * 1024 * 1024, rows: 25000, cells: 500000 };
const yieldMapper = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

function mappedValue(value: SourceRow[string], field: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (field.endsWith("Amount") || field === "Amount Paid") {
    if (!/^\$?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) {
      throw new Error("use a non-negative amount such as 1234.50 (no mixed currencies or text)");
    }
    const amount = Number(text.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) throw new Error("amount is too large");
    return String(amount);
  }
  if (field === "Date" || field.endsWith(" Date")) {
    // Ambiguous dates must be corrected by the owner, never guessed by AI.
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) throw new Error("use an unambiguous date in YYYY-MM-DD format");
    const date = new Date(text + "T00:00:00Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error("date does not exist");
  }
  if (["Contacted", "Estimate Sent"].includes(field)) {
    if (/^(yes|true|1)$/i.test(text)) return "Yes";
    if (/^(no|false|0)$/i.test(text)) return "No";
    throw new Error("use Yes/No, True/False, or 1/0");
  }
  return text;
}

async function normalizeMappedCSV(sourceRows: SourceRow[], columns: string[], proposal: MapperProposal): Promise<string> {
  const validated = validateMapperProposal(proposal, columns);
  const mappings = validated.mappings.filter(mapping => mapping.standardField !== "Unmapped");
  if (!sourceRows.length || !mappings.length) throw new Error("Choose at least one mapped field and a file with data rows.");
  if (new Set(mappings.map(mapping => mapping.standardField)).size !== mappings.length) {
    throw new Error("Each standard field must map to only one source column. Choose Unmapped for duplicates or combine them in your source file.");
  }
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [mappings.map(mapping => escapeCell(mapping.standardField)).join(",")];
  let failures = 0;
  const examples: string[] = [];
  for (let index = 0; index < sourceRows.length; index++) {
    const row = sourceRows[index];
    const values: string[] = [];
    for (const mapping of mappings) {
      try {
        if (!Object.prototype.hasOwnProperty.call(row, mapping.sourceColumn)) throw new Error("source column is missing");
        values.push(mappedValue(row[mapping.sourceColumn], mapping.standardField));
      } catch (error) {
        failures++;
        if (examples.length < 8) examples.push(`Data row ${index + 1}, ${mapping.sourceColumn} → ${mapping.standardField}: ${error instanceof Error ? error.message : "invalid value"}.`);
      }
    }
    if (values.every(value => !value)) {
      failures++;
      if (examples.length < 8) examples.push(`Data row ${index + 1} has no populated mapped fields; it would be skipped by the detector.`);
    }
    lines.push(values.map(escapeCell).join(","));
    if (index % 500 === 0) await yieldMapper();
  }
  if (failures) throw new Error(`${failures.toLocaleString()} validation issue(s). Nothing was analyzed or saved. Correct the source file or mapping and try again.\n${examples.join("\n")}${failures > examples.length ? "\nAdditional issues omitted from this preview." : ""}`);
  return lines.join("\r\n");
}

function AIDataMapper({ onAnalyze, disabled }: {
  onAnalyze: (file: File, csvText: string, originalRows: SourceRow[]) => Promise<boolean>;
  disabled: boolean;
}) {
  const [source, setSource] = useState<{ file: File; fileName: string; columns: string[]; rows: SourceRow[]; sampleRows: SourceRow[]; sheetName: string } | null>(null);
  const [proposal, setProposal] = useState<MapperProposal | null>(null);
  const [warningsReviewed, setWarningsReviewed] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completion, setCompletion] = useState("");
  const [converting, setConverting] = useState(false);
  const analyzing = useRef(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);

  function resetReview() {
    setProposal(null);
    setWarningsReviewed(false);
    setApproved(false);
    setCompletion("");
    setMessage("");
  }

  async function selectFile(file: File) {
    if (disabled || analyzing.current) return;
    const version = ++generation.current;
    request.current?.abort();
    resetReview();
    setSource(null);
    setBusy(true);
    try {
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Choose a CSV or Excel file.");
      if (file.size > MAPPER_LIMITS.bytes) throw new Error("Choose a file up to 10 MB. Split larger exports into smaller files; no rows will be truncated.");
      await yieldMapper();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", raw: true });
      const sheetName = workbook.SheetNames.includes("Business Data") ? "Business Data" : workbook.SheetNames[0];
      if (!sheetName) throw new Error("This file has no worksheet.");
      if (workbook.SheetNames.length > 1) throw new Error("This workbook has multiple sheets. Export the intended sheet as a separate file so other sheets are not silently excluded.");
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet["!ref"]) throw new Error("This worksheet is empty.");
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      if (range.e.r + 1 > MAPPER_LIMITS.rows + 1 || range.e.c + 1 > 100 || (range.e.r + 1) * (range.e.c + 1) > MAPPER_LIMITS.cells) throw new Error("This sheet exceeds the browser limit: 25,000 data rows, 100 columns, or 500,000 cells. Split the export; no rows were truncated.");
      if (worksheet["!merges"]?.length) throw new Error("Unmerge spreadsheet cells and repeat their values before importing.");
      for (const address of Object.keys(worksheet)) {
        if (!address.startsWith("!") && worksheet[address]?.t === "e") throw new Error(`Spreadsheet error at ${address}. Correct it before importing.`);
      }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false, blankrows: true, range: 0 });
      if (rows.length < 2) throw new Error("Include a header row and at least one data row.");
      const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
      const columns = Array.from({ length: width }, (_, index) => String(rows[0][index] ?? "").trim());
      if (columns.length > 100) throw new Error("The mapper supports up to 100 columns. Choose a smaller file.");
      if (columns.some(c => !c || c.length > 100)) throw new Error("Each column needs a non-empty header of at most 100 characters. Update the file and select it again.");
      if (new Set(columns.map(c => c.toLowerCase())).size !== columns.length) throw new Error("Duplicate column headers found. Give each column a unique name and select the file again.");
      if (rows.slice(1).some(row => row.every(value => String(value ?? "").trim() === ""))) throw new Error("Blank data rows found. Remove them before importing so every source row can be accounted for.");
      const sourceRows: SourceRow[] = rows.slice(1).map(row => Object.fromEntries(columns.map((column, index) => [column, String(row[index] ?? "")])));
      const sampleRows = sourceRows.slice(0, 20).map(row => Object.fromEntries(columns.map(column => [column, String(row[column] ?? "").slice(0, 300)])));
      if (version === generation.current) setSource({ file, fileName: file.name, columns, rows: sourceRows, sampleRows, sheetName });
    } catch (error) {
      if (version === generation.current) setMessage(error instanceof Error ? error.message : "Unable to read this file.");
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }

  async function proposeMapping() {
    if (!source || busy || disabled || analyzing.current) return;
    const version = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    resetReview();
    setBusy(true);
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/ai/map-data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: source.fileName, columns: source.columns, sampleRows: source.sampleRows }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok || body.success !== true) throw new Error(typeof body.error === "string" ? body.error : "AI mapping failed. Please try again.");
      const result = validateMapperProposal(body.mapping, source.columns);
      if (version === generation.current) setProposal(result);
    } catch (error) {
      if (version === generation.current) setMessage(controller.signal.aborted ? "Mapping timed out. Please try again." : error instanceof Error ? error.message : "AI mapping failed. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      if (version === generation.current) setBusy(false);
    }
  }

  const duplicateFields = proposal ? [...new Set(proposal.mappings.filter(m => m.standardField !== "Unmapped" && proposal.mappings.filter(other => other.standardField === m.standardField).length > 1).map(m => m.standardField))] : [];
  const unmapped = proposal ? proposal.mappings.filter(m => m.standardField === "Unmapped").map(m => m.sourceColumn) : [];
  const canApprove = !!source && !!proposal && warningsReviewed && duplicateFields.length === 0 && proposal.mappings.some(m => m.standardField !== "Unmapped");

  async function approveAndAnalyze() {
    if (!canApprove || !source || !proposal || approved || busy || disabled || analyzing.current) return;
    analyzing.current = true;
    setConverting(true);
    setBusy(true);
    setMessage("");
    const version = generation.current;
    try {
      const csvText = await normalizeMappedCSV(source.rows, source.columns, proposal);
      if (version !== generation.current) return;
      const saved = await onAnalyze(source.file, csvText, source.rows);
      if (version !== generation.current) return;
      setApproved(true);
      setCompletion(saved
        ? `Analyzed all ${source.rows.length.toLocaleString()} source rows using the approved mappings and saved the results.`
        : "Analysis completed, but saving failed. See the analysis error on this page. Results remain available in this session.");
    } catch (error) {
      if (version === generation.current) setMessage(error instanceof Error ? error.message : "Unable to analyze the mapped data.");
    } finally {
      analyzing.current = false;
      if (version === generation.current) {
        setConverting(false);
        setBusy(false);
      }
    }
  }

  return (
    <section aria-label="AI Data Mapper" className="mt-6 min-w-0 max-w-full rounded-xl border border-violet-500/30 bg-slate-950 p-5 text-left">
      <h3 className="text-xl font-bold text-violet-300">AI Data Mapper</h3>
      <p className="mt-2 text-sm text-slate-300">Have an export with unfamiliar column names? Choose a separate file to review suggested mappings. After you review the mappings, check the review box, and click Approve reviewed mapping and analyze, the full file is converted into standard fields and scanned by the rule-based leak detector. AI mapping does not create confirmed leaks.</p>
      <p className="mt-2 text-xs text-slate-400">Browser limits: 10 MB, 25,000 data rows, 100 columns, and 500,000 cells. Use one worksheet with no blank data rows. Mapped dates must use YYYY-MM-DD; amounts must be non-negative numbers. Running the mapper sends the file name, column names, and up to 20 sample rows (300 characters per cell) for AI review.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="rounded-lg border border-violet-400/50 px-4 py-2 focus-within:ring-2 focus-within:ring-violet-300 cursor-pointer">
          Choose mapper file
          <input type="file" accept=".csv,.xlsx,.xls" aria-label="Choose AI mapper file" disabled={busy || disabled} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void selectFile(file); }} />
        </label>
        <button type="button" disabled={!source || busy || disabled} onClick={() => void proposeMapping()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">{busy ? "Working…" : proposal ? "Run mapper again" : "Propose mappings"}</button>
      </div>
      {source && <p className="mt-3 text-sm text-slate-300">{source.fileName} · Sheet: {source.sheetName} · {source.columns.length} columns · {source.rows.length.toLocaleString()} total rows · {source.sampleRows.length} sample rows</p>}
      {busy && <p role="status" className="mt-3 text-sm">{converting ? "Analyzing approved data…" : "Preparing your mapping preview…"}</p>}
      {message && <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-red-300">{message}</p>}
      {proposal && <div className="mt-5 space-y-4">
        <p>{proposal.summary}</p>
        <p className="text-sm text-violet-300">Overall confidence: {proposal.overallConfidence}. Fields are pre-filled with the AI suggestions. Change any selection as needed, then confirm your review below.</p>
        <div className="max-h-[32rem] max-w-full overflow-auto rounded-lg border border-slate-800" role="region" aria-label="Column mappings, scroll horizontally to see all columns" tabIndex={0}>
          <table className="w-full min-w-[1120px] table-auto text-left text-sm">
            <caption className="sr-only">Proposed column mappings and review controls</caption>
            <thead className="sticky top-0 bg-slate-950 text-slate-400"><tr>{["Source column", "Proposed field", "Confidence", "AI review required", "Reason"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-3">{label}</th>)}</tr></thead>
            <tbody>{proposal.mappings.map(mapping => <tr key={mapping.sourceColumn} className="border-t border-slate-800">
              <th scope="row" className="min-w-[180px] whitespace-nowrap break-normal p-3 align-top">{mapping.sourceColumn}</th>
              <td className="min-w-[240px] whitespace-nowrap break-normal p-3 align-top">
                <select aria-label={`Standard field for ${mapping.sourceColumn}`} value={mapping.standardField} disabled={busy || disabled || approved}
                  className="w-full min-w-[216px] whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  onChange={event => {
                    const field = event.target.value;
                    setProposal(previous => previous ? { ...previous, mappings: previous.mappings.map(item => item.sourceColumn === mapping.sourceColumn ? { ...item, standardField: field } : item) } : previous);
                    setWarningsReviewed(false);
                    setMessage("");
                    setApproved(false);
                    setCompletion("");
                  }}>
                  {MAPPER_FIELDS.map(field => <option key={field} value={field}>{field}</option>)}
                </select>
              </td>
              <td className="min-w-[110px] whitespace-nowrap break-normal p-3 align-top">{mapping.confidence}</td>
              <td className="min-w-[170px] whitespace-nowrap break-normal p-3 align-top">{mapping.reviewRequired ? "Yes" : "No"}</td>
              <td className="w-full min-w-[420px] whitespace-normal [overflow-wrap:anywhere] p-3 align-top leading-6">{mapping.reason}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {[
          { title: "Duplicate warnings", items: [...proposal.duplicateWarnings, ...duplicateFields.map(field => `Multiple columns map to ${field}. Approval is blocked. Choose a different field or Unmapped for the duplicate column, then confirm your review below.`)] },
          { title: "Data-quality warnings", items: proposal.dataQualityWarnings },
          { title: "Unmapped columns", items: unmapped },
        ].map(group => <div key={group.title} className="rounded-lg border border-slate-800 p-3">
          <h4 className="font-semibold">{group.title}</h4>
          {group.items.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">{group.items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-slate-400">None reported.</p>}
        </div>)}
        <p className="text-xs text-slate-400">AI warnings and reasons reflect the original sample proposal. Review any field changes carefully. Unmapped columns are excluded from the detector input; all original columns and rows remain available for AI Discovery in this session.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy || disabled || approved} checked={warningsReviewed} onChange={event => { setWarningsReviewed(event.target.checked); setApproved(false); }} />I have reviewed the selected mappings, warnings, and unmapped columns and accept these mappings.</label>
        <button type="button" disabled={!canApprove || approved || busy || disabled} onClick={() => void approveAndAnalyze()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">{approved ? "Approved and analyzed" : converting ? "Analyzing…" : "Approve reviewed mapping and analyze"}</button>
        <p role="status" className="text-sm text-slate-300">{approved ? completion : duplicateFields.length > 0 ? "Resolve duplicate field selections before approving." : !proposal.mappings.some(mapping => mapping.standardField !== "Unmapped") ? "Select at least one standard field before approving." : "Review the pre-filled selections, make any changes, then check the review box above to enable approval. Review confirmation resets when a selection, file, or proposal changes."}</p>
      </div>}
    </section>
  );
}

