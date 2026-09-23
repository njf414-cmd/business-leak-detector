"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import PersistentScanSourceCard from "./PersistentScanSourceCard";

type SetupMode = "manual" | "ai" | "done_for_you";
type OnboardingStatus = "not_started" | "in_progress" | "ready" | "paused";
type DataStatus = "not_connected" | "needs_mapping" | "ready" | "error";
type ReportFrequency = "manual" | "weekly" | "biweekly" | "monthly";

type AutomationSettings = {
  business_id: string;
  setup_mode: SetupMode;
  onboarding_status: OnboardingStatus;
  data_status: DataStatus;
  recurring_scans_enabled: boolean;
  report_frequency: ReportFrequency;
  notifications_enabled: boolean;
  notification_email: string | null;
  timezone: string;
  next_scan_at: string | null;
  last_scan_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  success: boolean;
  settings?: AutomationSettings;
  error?: string;
};

const setupOptions: Array<{
  value: SetupMode;
  title: string;
  description: string;
}> = [
  {
    value: "manual",
    title: "Manual Setup",
    description: "You format and upload your own business data.",
  },
  {
    value: "ai",
    title: "AI Setup",
    description: "AI helps clean, map, and prepare your uploaded data.",
  },
  {
    value: "done_for_you",
    title: "Done-For-You",
    description: "Our team handles the setup, mapping, QA, and upload.",
  },
];

const statusLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSave = useMemo(
    () => Boolean(settings) && !loading && !saving,
    [settings, loading, saving]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/customer-automation/settings", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success || !payload.settings) {
          throw new Error(payload.error || "Could not load automation settings.");
        }

        if (!cancelled) {
          setSettings(payload.settings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load automation settings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof AutomationSettings>(
    key: K,
    value: AutomationSettings[K]
  ) {
    setSettings((current) =>
      current ? { ...current, [key]: value } : current
    );
    setMessage("");
    setError("");
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/customer-automation/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          setup_mode: settings.setup_mode,
          onboarding_status: settings.onboarding_status,
          data_status: settings.data_status,
          recurring_scans_enabled: settings.recurring_scans_enabled,
          report_frequency: settings.report_frequency,
          notifications_enabled: settings.notifications_enabled,
          notification_email: settings.notification_email || null,
          timezone: settings.timezone,
        }),
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.success || !payload.settings) {
        throw new Error(payload.error || "Could not save automation settings.");
      }

      setSettings(payload.settings);
      setMessage("Automation settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save automation settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "40px 20px 80px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginBottom: 18,
            color: "inherit",
            opacity: 0.75,
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </Link>

        <h1 style={{ fontSize: 34, margin: 0 }}>Automation Settings</h1>
        <p style={{ marginTop: 10, opacity: 0.72, lineHeight: 1.6 }}>
          Control how your Business Leak Detector account is set up, scanned,
          and reported.
        </p>
      </div>

      {loading && (
        <section style={panelStyle}>
          <strong>Loading your automation settings...</strong>
        </section>
      )}

      {!loading && error && !settings && (
        <section style={panelStyle}>
          <strong>Could not load settings.</strong>
          <p style={{ marginBottom: 0 }}>{error}</p>
        </section>
      )}

      {settings && (
        <>
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>1. Choose your setup method</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {setupOptions.map((option) => {
                const selected = settings.setup_mode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => update("setup_mode", option.value)}
                    style={{
                      textAlign: "left",
                      padding: 18,
                      borderRadius: 14,
                      border: selected
                        ? "2px solid currentColor"
                        : "1px solid rgba(127,127,127,.35)",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      opacity: selected ? 1 : 0.82,
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: 8 }}>
                      {option.title}
                    </strong>
                    <span style={{ lineHeight: 1.5, fontSize: 14 }}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>2. Onboarding status</h2>

            <div style={twoColumnStyle}>
              <label style={fieldStyle}>
                <span>Onboarding</span>
                <select
                  value={settings.onboarding_status}
                  onChange={(event) =>
                    update(
                      "onboarding_status",
                      event.target.value as OnboardingStatus
                    )
                  }
                  style={inputStyle}
                >
                  {["not_started", "in_progress", "ready", "paused"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {statusLabel(value)}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label style={fieldStyle}>
                <span>Data readiness</span>
                <select
                  value={settings.data_status}
                  onChange={(event) =>
                    update("data_status", event.target.value as DataStatus)
                  }
                  style={inputStyle}
                >
                  {["not_connected", "needs_mapping", "ready", "error"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {statusLabel(value)}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>3. Recurring scans & reports</h2>

            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.recurring_scans_enabled}
                onChange={(event) =>
                  update("recurring_scans_enabled", event.target.checked)
                }
              />
              <span>
                <strong>Enable recurring scans</strong>
                <small style={helperStyle}>
                  Automatically re-check your business for new revenue leaks.
                </small>
              </span>
            </label>

            <label style={{ ...fieldStyle, marginTop: 20 }}>
              <span>Report frequency</span>
              <select
                value={settings.report_frequency}
                onChange={(event) =>
                  update(
                    "report_frequency",
                    event.target.value as ReportFrequency
                  )
                }
                style={inputStyle}
                disabled={!settings.recurring_scans_enabled}
              >
                {["manual", "weekly", "biweekly", "monthly"].map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{
                marginTop: 18,
                fontSize: 14,
                opacity: 0.7,
                lineHeight: 1.6,
              }}
            >
              <div>
                Last scan:{" "}
                {settings.last_scan_at
                  ? new Date(settings.last_scan_at).toLocaleString()
                  : "Not yet"}
              </div>
              <div>
                Next scan:{" "}
                {settings.next_scan_at
                  ? new Date(settings.next_scan_at).toLocaleString()
                  : "Not scheduled"}
              </div>
            </div>
          </section>

          <PersistentScanSourceCard
            onSourceReady={() => {
              setSettings((current) =>
                current ? { ...current, data_status: "ready" } : current
              );
              setMessage("Recurring scan data is ready.");
              setError("");
            }}
          />

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>5. Notifications</h2>

            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.notifications_enabled}
                onChange={(event) =>
                  update("notifications_enabled", event.target.checked)
                }
              />
              <span>
                <strong>Send notifications</strong>
                <small style={helperStyle}>
                  Receive updates when scans complete or important leaks are
                  detected.
                </small>
              </span>
            </label>

            <div style={{ ...twoColumnStyle, marginTop: 20 }}>
              <label style={fieldStyle}>
                <span>Notification email</span>
                <input
                  type="email"
                  value={settings.notification_email ?? ""}
                  onChange={(event) =>
                    update("notification_email", event.target.value)
                  }
                  placeholder="you@business.com"
                  style={inputStyle}
                  disabled={!settings.notifications_enabled}
                />
              </label>

              <label style={fieldStyle}>
                <span>Timezone</span>
                <input
                  value={settings.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  placeholder="America/New_York"
                  style={inputStyle}
                />
              </label>
            </div>
          </section>

          <section style={{ ...panelStyle, position: "sticky", bottom: 16 }}>
            {error && (
              <div style={{ marginBottom: 12 }}>
                <strong>Could not save:</strong> {error}
              </div>
            )}

            {message && (
              <div style={{ marginBottom: 12 }}>
                <strong>{message}</strong>
              </div>
            )}

            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={!canSave}
              style={{
                width: "100%",
                border: 0,
                borderRadius: 12,
                padding: "14px 18px",
                fontWeight: 700,
                cursor: canSave ? "pointer" : "not-allowed",
                opacity: canSave ? 1 : 0.55,
              }}
            >
              {saving ? "Saving..." : "Save automation settings"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

const panelStyle = {
  border: "1px solid rgba(127,127,127,.28)",
  borderRadius: 18,
  padding: 22,
  marginBottom: 18,
  background: "rgba(127,127,127,.05)",
} as const;

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 18,
  fontSize: 20,
} as const;

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
} as const;

const fieldStyle = {
  display: "grid",
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
} as const;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid rgba(127,127,127,.4)",
  padding: "11px 12px",
  background: "transparent",
  color: "inherit",
  font: "inherit",
} as const;

const toggleStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
  lineHeight: 1.5,
} as const;

const helperStyle = {
  display: "block",
  marginTop: 3,
  opacity: 0.68,
  fontWeight: 400,
} as const;
