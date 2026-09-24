"use client";

import Link from "next/link";

export type DashboardTab =
  | "Dashboard"
  | "Leaks"
  | "Analytics"
  | "Data";

type AppSidebarProps = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onNewAnalysis: () => void;
  businessName?: string;
};

const items: Array<{
  label: DashboardTab;
  premium?: boolean;
}> = [
  { label: "Dashboard" },
  { label: "Leaks" },
  { label: "Analytics" },
  { label: "Data" },
];

function NavButton({
  label,
  active,
  onClick,
  premium = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  premium?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-white/10 text-white"
          : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
      }`}
    >
      <span>{label}</span>

      {premium && (
        <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
          PRO
        </span>
      )}
    </button>
  );
}

export default function AppSidebar({
  activeTab,
  onTabChange,
  onNewAnalysis,
  businessName,
}: AppSidebarProps) {
  function selectTab(tab: DashboardTab) {
    onTabChange(tab);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[0.07] bg-[#171717] lg:flex">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              Business Leak Detector
            </p>

            <p className="truncate text-xs text-zinc-500">
              {businessName || "Your business"}
            </p>
          </div>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onNewAnalysis}
            className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            + New analysis
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) => (
            <NavButton
              key={item.label}
              label={item.label}
              active={activeTab === item.label}
              onClick={() => selectTab(item.label)}
              premium={item.premium}
            />
          ))}

          <div className="my-3 border-t border-white/[0.07]" />

          <Link
            href="/reports"
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <span>Reports</span>
          </Link>

          <Link
            href="/settings/automation"
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-amber-300 transition hover:bg-amber-400/[0.08]"
          >
            <span>Automation</span>

            <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
              PRO
            </span>
          </Link>
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-200">
                  Premium features
                </p>

                <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                  Automatic scans and advanced tools.
                </p>
              </div>

              <span className="text-amber-300">✦</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#212121]/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Business Leak Detector
            </p>

            <p className="max-w-[180px] truncate text-[11px] text-zinc-500">
              {businessName || "Your business"}
            </p>
          </div>

          <Link
            href="/reports"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200"
          >
           eports
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => selectTab(item.label)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${
                activeTab === item.label
                  ? "bg-white/10 text-white"
                  : "text-zinc-400"
              }`}
            >
              {item.label}
            </button>
          ))}

          <Link
            href="/settings/automation"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-amber-300"
          >
            Automation · PRO
          </Link>
        </nav>
      </div>
    </>
  );
}
