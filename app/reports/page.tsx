"use client";

import Link from "next/link";
import SecondarySidebar from "../components/SecondarySidebar";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

type TopLeak = {
  customer: string;
  type: string;
  amount: number;
  recovery: number;
  severity: string;
  reason: string;
  action: string;
  status: string;
  priorityScore: number;
  priorityLevel: string;
};

type ReportRow = {
  id: string;
  analysis_id: string;
  previous_analysis_id:
    | string
    | null;
  status: string;
  scan_date: string;
  revenue_at_risk:
    | number
    | string
    | null;
  estimated_recovery:
    | number
    | string
    | null;
  recovered_amount:
    | number
    | string
    | null;
  leaks_found:
    | number
    | string
    | null;
  new_leaks:
    | number
    | string
    | null;
  resolved_leaks:
    | number
    | string
    | null;
  previous_revenue_at_risk:
    | number
    | string
    | null;
  revenue_risk_change:
    | number
    | string
    | null;
  top_leaks: unknown;
  created_at: string;
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(
  value:
    | number
    | string
    | null
    | undefined
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(
    numberValue(value)
  );
}

function dateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function parseTopLeaks(
  value: unknown
): TopLeak[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(
          item &&
          typeof item ===
            "object"
        )
    )
    .map(
      (item) => ({
        customer:
          typeof item.customer ===
          "string"
            ? item.customer
            : "Unknown",

        type:
          typeof item.type ===
          "string"
            ? item.type
            : "Unknown",

        amount:
          numberValue(
            item.amount as
              | number
              | string
              | null
          ),

        recovery:
          numberValue(
            item.recovery as
              | number
              | string
              | null
          ),

        severity:
          typeof item.severity ===
          "string"
            ? item.severity
            : "medium",

        reason:
          typeof item.reason ===
          "string"
            ? item.reason
            : "",

        action:
          typeof item.action ===
          "string"
            ? item.action
            : "",

        status:
          typeof item.status ===
          "string"
            ? item.status
            : "Open",

        priorityScore:
          numberValue(
            item.priorityScore as
              | number
              | string
              | null
          ),

        priorityLevel:
          typeof item.priorityLevel ===
          "string"
            ? item.priorityLevel
            : "Medium",
      })
    );
}

function metricCard(
  label: string,
  value: string,
  description: string
) {
  return (
    <div
      style={{
        border:
          "1px solid rgba(148,163,184,0.22)",
        borderRadius: 16,
        padding: 20,
        background:
          "rgba(15,23,42,0.72)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          opacity: 0.68,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: -0.8,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          opacity: 0.56,
          marginTop: 8,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [
    reports,
    setReports,
  ] = useState<ReportRow[]>(
    []
  );

  const [
    selectedId,
    setSelectedId,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const {
        data,
        error:
          reportsError,
      } = await supabase
        .from(
          "customer_reports"
        )
        .select(
          "id,analysis_id,previous_analysis_id,status,scan_date,revenue_at_risk,estimated_recovery,recovered_amount,leaks_found,new_leaks,resolved_leaks,previous_revenue_at_risk,revenue_risk_change,top_leaks,created_at"
        )
        .order(
          "scan_date",
          {
            ascending: false,
          }
        )
        .limit(50);

      if (reportsError) {
        throw reportsError;
      }

      const rows =
        (data ??
          []) as ReportRow[];

      setReports(rows);

      setSelectedId(
        (current) => {
          if (
            current &&
            rows.some(
              (report) =>
                report.id ===
                current
            )
          ) {
            return current;
          }

          return (
            rows[0]?.id ??
            null
          );
        }
      );
    } catch (
      loadError
    ) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load reports."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadReports();
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, []);

  const selected =
    useMemo(
      () =>
        reports.find(
          (report) =>
            report.id ===
            selectedId
        ) ??
        reports[0] ??
        null,
      [
        reports,
        selectedId,
      ]
    );

  const topLeaks =
    useMemo(
      () =>
        parseTopLeaks(
          selected?.top_leaks
        ),
      [selected]
    );

  const riskChange =
    numberValue(
      selected?.revenue_risk_change
    );

  const previousRisk =
    selected
      ? selected.previous_revenue_at_risk
      : null;

  return (
    <main className="min-h-screen bg-[#212121] text-zinc-100">
      <SecondarySidebar active="Reports" />

      <section className="min-h-screen lg:pl-[260px]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Reports
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Business reports
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                See what changed between scans and where your biggest recovery
                opportunities are.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadReports()}
              disabled={loading}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </header>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && reports.length === 0 && (
            <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#262626] p-8 text-zinc-500">
              Loading reports...
            </div>
          )}

          {!loading && reports.length === 0 && (
            <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#262626] p-8 text-center">
              <h2 className="text-xl font-semibold text-white">
                No reports yet
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                Run an analysis to generate your first report.
              </p>

              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black"
              >
                Run analysis
              </Link>
            </section>
          )}

          {selected && (
            <div className="mt-8 space-y-6">
              <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#262626] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Selected report
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {dateTime(selected.scan_date)}
                  </h2>
                </div>

                <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1 text-xs font-medium text-emerald-300">
                  {selected.status}
                </span>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">Revenue at risk</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {money(selected.revenue_at_risk)}
                  </p>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">Estimated recovery</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-400">
                    {money(selected.estimated_recovery)}
                  </p>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">Recovered</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-400">
                    {money(selected.recovered_amount)}
                  </p>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">Leaks found</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {numberValue(selected.leaks_found)}
                  </p>
                </article>
              </section>

              <section className="grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">New leaks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {numberValue(selected.new_leaks)}
                  </p>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">Resolved leaks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {numberValue(selected.resolved_leaks)}
                  </p>
                </article>

                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5">
                  <p className="text-sm text-zinc-500">Risk change</p>

                  <p
                    className={
                      riskChange > 0
                        ? "mt-2 text-2xl font-semibold text-red-400"
                        : riskChange < 0
                        ? "mt-2 text-2xl font-semibold text-emerald-400"
                        : "mt-2 text-2xl font-semibold text-white"
                    }
                  >
                    {riskChange > 0 ? "+" : ""}
                    {money(riskChange)}
                  </p>

                  {previousRisk !== null && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Previous: {money(previousRisk)}
                    </p>
                  )}
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#262626]">
                  <div className="border-b border-white/[0.07] p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Action center
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-white">
                      Top priority leaks
                    </h3>
                  </div>

                  {topLeaks.length > 0 ? (
                    <div className="divide-y divide-white/[0.07]">
                      {topLeaks.slice(0, 5).map((leak, index) => (
                        <article
                          key={`${leak.customer}-${leak.type}-${index}`}
                          className="p-5 sm:p-6"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07] text-xs text-zinc-400">
                                  {index + 1}
                                </span>

                                <p className="font-medium text-white">
                                  {leak.customer}
                                </p>
                              </div>

                              <p className="mt-2 text-sm text-zinc-500">
                                {leak.type}
                              </p>

                              <p className="mt-3 text-sm leading-6 text-zinc-400">
                                {leak.reason}
                              </p>

                              <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                                  Recommended action
                                </p>

                                <p className="mt-2 text-sm leading-6 text-zinc-300">
                                  {leak.action}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 sm:text-right">
                              <p className="font-semibold text-white">
                                {money(leak.amount)}
                              </p>

                              <p className="mt-1 text-sm font-medium text-emerald-400">
                                ~{money(leak.recovery)}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-zinc-500">
                      No priority leaks in this report.
                    </div>
                  )}
                </div>

                <aside className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#262626]">
                  <div className="border-b border-white/[0.07] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      History
                    </p>

                    <h3 className="mt-2 font-semibold text-white">
                      Previous reports
                    </h3>
                  </div>

                  <div className="max-h-[620px] divide-y divide-white/[0.07] overflow-y-auto">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => setSelectedId(report.id)}
                        className={
                          report.id === selected.id
                            ? "w-full bg-white/[0.06] p-4 text-left"
                            : "w-full p-4 text-left transition hover:bg-white/[0.035]"
                        }
                      >
                        <p className="text-sm font-medium text-zinc-200">
                          {dateTime(report.scan_date)}
                        </p>

                        <div className="mt-2 flex justify-between gap-3 text-xs">
                          <span className="text-zinc-500">Risk</span>
                          <span className="text-zinc-300">
                            {money(report.revenue_at_risk)}
                          </span>
                        </div>

                        <div className="mt-1 flex justify-between gap-3 text-xs">
                          <span className="text-zinc-500">Leaks</span>
                          <span className="text-zinc-300">
                            {numberValue(report.leaks_found)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>
              </section>

              <Link
                href="/settings/automation"
                className="block rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5 transition hover:bg-amber-400/[0.07]"
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-amber-200">
                    Automatic reports
                  </p>

                  <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    PRO
                  </span>
                </div>

                <p className="mt-2 text-sm text-zinc-500">
                  Schedule recurring scans and receive reports automatically.
                </p>

                <p className="mt-4 text-sm font-medium text-amber-300">
                  Manage automation →
                </p>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
