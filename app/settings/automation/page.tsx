"use client";

import SecondarySidebar from "../../components/SecondarySidebar";

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

type BillingResponse = {
  success: boolean;
  hasProAccess?: boolean;
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

  const [billingLoading, setBillingLoading] = useState(true);
  const [hasProAccess, setHasProAccess] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      setBillingLoading(true);

      try {
        const response = await fetch("/api/billing/subscription", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const payload = (await response.json()) as BillingResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error || "Could not load subscription."
          );
        }

        if (!cancelled) {
          setHasProAccess(Boolean(payload.hasProAccess));
        }
      } catch {
        if (!cancelled) {
          setHasProAccess(false);
        }
      } finally {
        if (!cancelled) {
          setBillingLoading(false);
        }
      }
    }

    void loadBilling();

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
    <main className="min-h-screen bg-[#212121] text-white">
      <SecondarySidebar active="Automation" />

      <section className="min-h-screen lg:pl-[260px]">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                  Automation
                </p>

                <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  PRO
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Run the detector automatically
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Keep your business data monitored, schedule recurring scans,
                and receive reports without manually running each analysis.
              </p>
            </div>

            {settings && (
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={!canSave}
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
            )}
          </div>

          {loading && (
            <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#262626] p-6">
              <p className="text-sm text-zinc-400">
                Loading your automation settings...
              </p>
            </section>
          )}

          {!loading && error && !settings && (
            <section className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-6">
              <p className="font-medium text-red-300">
                Could not load automation settings.
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                {error}
              </p>
            </section>
          )}

          {settings && (
            <div className="mt-8 space-y-5">
              {!billingLoading && !hasProAccess && (
                <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="text-lg">🔒</span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">
                          Upgrade to PRO to unlock automation.
                        </p>

                        <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          PRO
                        </span>
                      </div>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                        AI setup, recurring scans, automatic reports, reusable
                        scan sources, and email notifications require PRO.
                      </p>
                    </div>
                  </div>
                </section>
              )}
              <section className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Setup
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Choose how your data gets prepared
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    Start manually, use AI-assisted setup, or let us handle the
                    entire process.
                  </p>
                </div>

                <div className="mt-6 grid gap-3 lg:grid-cols-3">
                  {setupOptions.map((option) => {
                    const selected = settings.setup_mode === option.value;
                    const premium = option.value !== "manual";
                    const locked = premium && !hasProAccess;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          if (locked) return;
                          update("setup_mode", option.value);
                        }}
                        disabled={locked}
                        className={
                          selected
                            ? premium
                              ? "rounded-xl border border-amber-400/40 bg-amber-400/[0.06] p-5 text-left"
                              : "rounded-xl border border-white/25 bg-white/[0.06] p-5 text-left"
                            : premium
                            ? "rounded-xl border border-amber-400/15 bg-[#1f1f1f] p-5 text-left transition hover:border-amber-400/30"
                            : "rounded-xl border border-white/[0.07] bg-[#1f1f1f] p-5 text-left transition hover:border-white/15"
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">
                            {option.title}
                          </p>

                          {premium ? (
                            <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              PRO
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-500">
                              INCLUDED
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-500">
                          {option.description}
                        </p>

                        {locked && (
                          <p className="mt-4 text-xs font-medium text-amber-300">
                            🔒 PRO subscription required
                          </p>
                        )}

                        {selected && !locked && (
                          <p
                            className={
                              premium
                                ? "mt-4 text-xs font-medium text-amber-300"
                                : "mt-4 text-xs font-medium text-emerald-400"
                            }
                          >
                            Selected
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <article className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Account status
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Setup readiness
                  </h2>

                  <div className="mt-6 space-y-5">
                    <label className="block">
                      <span className="text-sm font-medium text-zinc-300">
                        Onboarding
                      </span>

                      <select
                        value={settings.onboarding_status}
                        onChange={(event) =>
                          update(
                            "onboarding_status",
                            event.target.value as OnboardingStatus
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
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

                    <label className="block">
                      <span className="text-sm font-medium text-zinc-300">
                        Data readiness
                      </span>

                      <select
                        value={settings.data_status}
                        onChange={(event) =>
                          update(
                            "data_status",
                            event.target.value as DataStatus
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
                      >
                        {[
                          "not_connected",
                          "needs_mapping",
                          "ready",
                          "error",
                        ].map((value) => (
                          <option key={value} value={value}>
                            {statusLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>

                <article className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                        Recurring scans
                      </p>

                      <h2 className="mt-2 text-xl font-semibold text-white">
                        Automatic leak monitoring
                      </h2>
                    </div>

                    <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                      PRO
                    </span>
                  </div>

                  <label className="mt-6 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={hasProAccess && settings.recurring_scans_enabled}
                        disabled={!hasProAccess}
                      onChange={(event) =>
                        update(
                          "recurring_scans_enabled",
                          event.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 accent-amber-400"
                    />

                    <span>
                      <span className="block text-sm font-medium text-white">
                        Enable recurring scans
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-zinc-500">
                        Automatically check your saved business data for new
                        revenue leaks.
                      </span>
                    </span>
                  </label>

                  <label className="mt-6 block">
                    <span className="text-sm font-medium text-zinc-300">
                      Scan frequency
                    </span>

                    <select
                      value={settings.report_frequency}
                      onChange={(event) =>
                        update(
                          "report_frequency",
                          event.target.value as ReportFrequency
                        )
                      }
                        disabled={
                          !hasProAccess ||
                          !settings.recurring_scans_enabled
                        }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none transition focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {["manual", "weekly", "biweekly", "monthly"].map(
                        (value) => (
                          <option key={value} value={value}>
                            {statusLabel(value)}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-[#1f1f1f] p-4">
                      <p className="text-xs text-zinc-500">
                        Last scan
                      </p>

                      <p className="mt-2 text-sm font-medium text-zinc-200">
                        {settings.last_scan_at
                          ? new Date(settings.last_scan_at).toLocaleString()
                          : "Not yet"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-[#1f1f1f] p-4">
                      <p className="text-xs text-zinc-500">
                        Next scan
                      </p>

                      <p className="mt-2 text-sm font-medium text-zinc-200">
                        {settings.next_scan_at
                          ? new Date(settings.next_scan_at).toLocaleString()
                          : "Not scheduled"}
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5 sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Scan source
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Data used for automatic scans
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    Keep a reusable source available so scheduled scans can run
                    without another manual upload.
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#1f1f1f]">
                  {hasProAccess ? (
                    <PersistentScanSourceCard
                      onSourceReady={() => {
                        setSettings((current) =>
                          current
                            ? { ...current, data_status: "ready" }
                            : current
                        );
                        setMessage("Recurring scan data is ready.");
                        setError("");
                      }}
                    />
                  ) : (
                    <div className="p-6">
                      <p className="font-medium text-white">
                        🔒 PRO subscription required
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Upgrade to PRO to save a reusable source for recurring scans.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-[#262626] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Notifications
                    </p>

                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Send reports automatically
                    </h2>
                  </div>

                  <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                    PRO
                  </span>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={hasProAccess && settings.notifications_enabled}
                      disabled={!hasProAccess}
                    onChange={(event) =>
                      update(
                        "notifications_enabled",
                        event.target.checked
                      )
                    }
                    className="mt-1 h-4 w-4 accent-amber-400"
                  />

                  <span>
                    <span className="block text-sm font-medium text-white">
                      Email scan results
                    </span>

                    <span className="mt-1 block text-sm leading-6 text-zinc-500">
                      Receive updates when scans finish or important revenue
                      leaks are detected.
                    </span>
                  </span>
                </label>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-300">
                      Notification email
                    </span>

                    <input
                      type="email"
                      value={settings.notification_email ?? ""}
                      onChange={(event) =>
                        update(
                          "notification_email",
                          event.target.value
                        )
                      }
                      placeholder="you@business.com"
                      disabled={
                        !hasProAccess ||
                        !settings.notifications_enabled
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-zinc-300">
                      Timezone
                    </span>

                    <input
                      value={settings.timezone}
                      onChange={(event) =>
                        update("timezone", event.target.value)
                      }
                      placeholder="America/New_York"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/25"
                    />
                  </label>
                </div>
              </section>

              {(message || error) && (
                <section
                  className={
                    error
                      ? "rounded-xl border border-red-400/20 bg-red-400/[0.04] px-5 py-4"
                      : "rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] px-5 py-4"
                  }
                >
                  <p
                    className={
                      error
                        ? "text-sm font-medium text-red-300"
                        : "text-sm font-medium text-emerald-300"
                    }
                  >
                    {error || message}
                  </p>
                </section>
              )}

              <div className="flex justify-end pb-8">
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={!canSave}
                  className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {saving ? "Saving..." : "Save automation settings"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
