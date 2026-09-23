"use client";

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
    void loadReports();
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
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #172554 0%, #020617 38%, #020617 100%)",
        color: "#f8fafc",
        padding:
          "32px 20px 80px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems:
              "center",
            justifyContent:
              "space-between",
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                opacity: 0.58,
                textTransform:
                  "uppercase",
                letterSpacing: 1.4,
                fontWeight: 700,
              }}
            >
              Business Leak
              Detector
            </div>

            <h1
              style={{
                margin:
                  "6px 0 6px",
                fontSize: 36,
                letterSpacing:
                  -1.3,
              }}
            >
              Reports
            </h1>

            <div
              style={{
                opacity: 0.62,
                lineHeight: 1.5,
              }}
            >
              Automatic leak
              analysis and
              recovery reports.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <a
              href="/"
              style={{
                padding:
                  "10px 14px",
                borderRadius: 10,
                border:
                  "1px solid rgba(148,163,184,0.28)",
                color: "inherit",
                textDecoration:
                  "none",
              }}
            >
              Dashboard
            </a>

            <a
              href="/settings/automation"
              style={{
                padding:
                  "10px 14px",
                borderRadius: 10,
                border:
                  "1px solid rgba(148,163,184,0.28)",
                color: "inherit",
                textDecoration:
                  "none",
              }}
            >
              Automation
            </a>

            <button
              type="button"
              onClick={() =>
                void loadReports()
              }
              disabled={loading}
              style={{
                padding:
                  "10px 14px",
                borderRadius: 10,
                border:
                  "1px solid rgba(148,163,184,0.28)",
                cursor:
                  loading
                    ? "default"
                    : "pointer",
              }}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div
            style={{
              border:
                "1px solid rgba(239,68,68,0.35)",
              borderRadius: 14,
              padding: 16,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        ) : null}

        {loading &&
        reports.length === 0 ? (
          <div
            style={{
              border:
                "1px solid rgba(148,163,184,0.22)",
              borderRadius: 16,
              padding: 28,
            }}
          >
            Loading reports...
          </div>
        ) : null}

        {!loading &&
        reports.length === 0 ? (
          <div
            style={{
              border:
                "1px solid rgba(148,163,184,0.22)",
              borderRadius: 18,
              padding: 36,
              background:
                "rgba(15,23,42,0.6)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              No reports yet
            </h2>

            <p
              style={{
                opacity: 0.68,
                maxWidth: 600,
                lineHeight: 1.6,
              }}
            >
              Reports are
              generated
              automatically
              after an analysis
              finishes. Run an
              analysis or enable
              recurring scans to
              create your first
              report.
            </p>
          </div>
        ) : null}

        {selected ? (
          <>
            <section
              style={{
                border:
                  "1px solid rgba(148,163,184,0.22)",
                borderRadius: 18,
                padding: 22,
                background:
                  "rgba(15,23,42,0.62)",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: 16,
                  alignItems:
                    "center",
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        13,
                      opacity:
                        0.56,
                    }}
                  >
                    Latest selected
                    report
                  </div>

                  <h2
                    style={{
                      margin:
                        "6px 0 0",
                    }}
                  >
                    {dateTime(
                      selected.scan_date
                    )}
                  </h2>
                </div>

                <div
                  style={{
                    padding:
                      "7px 11px",
                    borderRadius:
                      999,
                    border:
                      "1px solid rgba(34,197,94,0.35)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {selected.status}
                </div>
              </div>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {metricCard(
                "Revenue at Risk",
                money(
                  selected.revenue_at_risk
                ),
                "Total value currently exposed across detected leaks."
              )}

              {metricCard(
                "Estimated Recovery",
                money(
                  selected.estimated_recovery
                ),
                "Estimated recoverable revenue from current leaks."
              )}

              {metricCard(
                "Recovered",
                money(
                  selected.recovered_amount
                ),
                "Revenue already marked as recovered."
              )}

              {metricCard(
                "Leaks Found",
                String(
                  numberValue(
                    selected.leaks_found
                  )
                ),
                "Total leaks detected in this scan."
              )}
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {metricCard(
                "New Leaks",
                String(
                  numberValue(
                    selected.new_leaks
                  )
                ),
                "Leaks not present in the previous scan."
              )}

              {metricCard(
                "Resolved Leaks",
                String(
                  numberValue(
                    selected.resolved_leaks
                  )
                ),
                "Previous leaks no longer detected."
              )}

              {metricCard(
                "Risk Change",
                `${
                  riskChange > 0
                    ? "+"
                    : ""
                }${money(
                  riskChange
                )}`,
                previousRisk ===
                null
                  ? "No previous scan available for comparison."
                  : riskChange <
                      0
                    ? "Revenue at risk decreased since the previous scan."
                    : riskChange >
                        0
                      ? "Revenue at risk increased since the previous scan."
                      : "Revenue at risk is unchanged."
              )}
            </section>

            <section
              style={{
                border:
                  "1px solid rgba(148,163,184,0.22)",
                borderRadius: 18,
                padding: 22,
                background:
                  "rgba(15,23,42,0.62)",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                  alignItems:
                    "center",
                  marginBottom:
                    18,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        13,
                      opacity:
                        0.58,
                    }}
                  >
                    Action Center
                  </div>

                  <h2
                    style={{
                      margin:
                        "5px 0 0",
                    }}
                  >
                    Top Priority
                    Leaks
                  </h2>
                </div>

                <div
                  style={{
                    opacity:
                      0.58,
                    fontSize:
                      13,
                  }}
                >
                  Top {topLeaks.length}
                </div>
              </div>

              {topLeaks.length ===
              0 ? (
                <div
                  style={{
                    opacity:
                      0.65,
                  }}
                >
                  No priority
                  leaks in this
                  report.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      "grid",
                    gap: 12,
                  }}
                >
                  {topLeaks.map(
                    (
                      leak,
                      index
                    ) => (
                      <div
                        key={`${leak.customer}-${leak.type}-${index}`}
                        style={{
                          border:
                            "1px solid rgba(148,163,184,0.18)",
                          borderRadius:
                            14,
                          padding:
                            18,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 14,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight:
                                  800,
                                fontSize:
                                  17,
                              }}
                            >
                              {leak.type}
                            </div>

                            <div
                              style={{
                                opacity:
                                  0.62,
                                marginTop:
                                  3,
                              }}
                            >
                              {leak.customer}
                            </div>
                          </div>

                          <div
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  800,
                              }}
                            >
                              {money(
                                leak.amount
                              )}
                            </div>

                            <div
                              style={{
                                fontSize:
                                  12,
                                opacity:
                                  0.6,
                                marginTop:
                                  3,
                              }}
                            >
                              {leak.priorityLevel}{" "}
                              priority
                            </div>
                          </div>
                        </div>

                        {leak.reason ? (
                          <div
                            style={{
                              marginTop:
                                14,
                              opacity:
                                0.7,
                              lineHeight:
                                1.55,
                            }}
                          >
                            <strong>
                              Why:
                            </strong>{" "}
                            {leak.reason}
                          </div>
                        ) : null}

                        {leak.action ? (
                          <div
                            style={{
                              marginTop:
                                10,
                              lineHeight:
                                1.55,
                            }}
                          >
                            <strong>
                              Recommended
                              action:
                            </strong>{" "}
                            {leak.action}
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop:
                              12,
                            display:
                              "flex",
                            gap: 16,
                            flexWrap:
                              "wrap",
                            fontSize:
                              13,
                            opacity:
                              0.64,
                          }}
                        >
                          <span>
                            Recovery:{" "}
                            {money(
                              leak.recovery
                            )}
                          </span>

                          <span>
                            Score:{" "}
                            {leak.priorityScore}
                          </span>

                          <span>
                            Status:{" "}
                            {leak.status}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section
              style={{
                border:
                  "1px solid rgba(148,163,184,0.22)",
                borderRadius: 18,
                padding: 22,
                background:
                  "rgba(15,23,42,0.62)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.58,
                }}
              >
                Previous scans
              </div>

              <h2
                style={{
                  margin:
                    "5px 0 18px",
                }}
              >
                Report History
              </h2>

              <div
                style={{
                  display:
                    "grid",
                  gap: 10,
                }}
              >
                {reports.map(
                  (report) => {
                    const active =
                      report.id ===
                      selected.id;

                    return (
                      <button
                        key={
                          report.id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedId(
                            report.id
                          )
                        }
                        style={{
                          width:
                            "100%",
                          textAlign:
                            "left",
                          padding:
                            14,
                          borderRadius:
                            12,
                          border:
                            active
                              ? "1px solid rgba(96,165,250,0.7)"
                              : "1px solid rgba(148,163,184,0.18)",
                          background:
                            active
                              ? "rgba(30,64,175,0.22)"
                              : "rgba(15,23,42,0.3)",
                          color:
                            "inherit",
                          cursor:
                            "pointer",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 12,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <span>
                            {dateTime(
                              report.scan_date
                            )}
                          </span>

                          <strong>
                            {money(
                              report.revenue_at_risk
                            )}{" "}
                            at risk
                          </strong>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
