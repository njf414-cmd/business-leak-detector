"use client";

import Link from "next/link";

type SecondarySidebarProps = {
  active: "Reports" | "Automation";
};

export default function SecondarySidebar({
  active,
}: SecondarySidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[0.07] bg-[#171717] lg:flex">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black">
            B
          </div>

          <div>
            <p className="text-sm font-semibold text-white">
              Business Leak Detector
            </p>

            <p className="text-xs text-zinc-500">
              Business intelligence
            </p>
          </div>
        </div>

        <div className="px-3 pb-3">
          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            + New analysis
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          <Link
            href="/"
            className="block rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            Dashboard
          </Link>

          <div className="my-3 border-t border-white/[0.07]" />

          <Link
            href="/reports"
            className={
              active === "Reports"
                ? "block rounded-lg bg-white/10 px-3 py-2.5 text-sm text-white"
                : "block rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
            }
          >
            Reports
          </Link>

          <Link
            href="/settings/automation"
            className={
              active === "Automation"
                ? "flex items-center justify-between rounded-lg bg-amber-400/[0.08] px-3 py-2.5 text-sm text-amber-300"
                : "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-amber-300 transition hover:bg-amber-400/[0.08]"
            }
          >
            <span>Automation</span>

            <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold">
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

              <span className="text-amber-300">
                ✦
              </span>
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#212121]/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="text-sm font-semibold text-white"
          >
            Business Leak Detector
          </Link>

          <span className="text-xs font-medium text-zinc-500">
            {active}
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <Link
            href="/"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-zinc-400"
          >
            Dashboard
          </Link>

          <Link
            href="/reports"
            className={
              active === "Reports"
                ? "whitespace-nowrap rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white"
                : "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-zinc-400"
            }
          >
            Reports
          </Link>

          <Link
            href="/settings/automation"
            className={
              active === "Automation"
                ? "whitespace-nowrap rounded-lg bg-amber-400/[0.08] px-3 py-2 text-xs font-medium text-amber-300"
                : "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-amber-300"
            }
          >
            Automation · PRO
          </Link>
        </nav>
      </div>
    </>
  );
}
