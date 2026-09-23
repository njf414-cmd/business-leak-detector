import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { DEFAULT_CUSTOMER_AUTOMATION_SETTINGS } from "../../../lib/customer-automation/types";
import { parseCustomerAutomationPatch } from "../../../lib/customer-automation/validation";
import { calculateNextScanAt } from "../../../lib/customer-automation/scheduler";

export const dynamic = "force-dynamic";

async function createAuthenticatedSupabase() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabase>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load business: ${error.message}`);
  }

  return data?.id ?? null;
}

async function ensureSettings(
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabase>>,
  businessId: string
) {
  const existing = await supabase
    .from("customer_automation_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(
      `Could not load automation settings: ${existing.error.message}`
    );
  }

  if (existing.data) {
    return existing.data;
  }

  const created = await supabase
    .from("customer_automation_settings")
    .insert({
      business_id: businessId,
      ...DEFAULT_CUSTOMER_AUTOMATION_SETTINGS,
    })
    .select("*")
    .single();

  if (created.error) {
    throw new Error(
      `Could not create automation settings: ${created.error.message}`
    );
  }

  return created.data;
}

async function getAuthContext() {
  const supabase = await createAuthenticatedSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      ),
    } as const;
  }

  const businessId = await getOwnedBusinessId(supabase, user.id);

  if (!businessId) {
    return {
      error: NextResponse.json(
        { success: false, error: "No business found for this account." },
        { status: 404 }
      ),
    } as const;
  }

  return { supabase, user, businessId } as const;
}

export async function GET() {
  try {
    const context = await getAuthContext();

    if ("error" in context) {
      return context.error;
    }

    const settings = await ensureSettings(
      context.supabase,
      context.businessId
    );

    return NextResponse.json(
      { success: true, settings },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("customer-automation.settings.get.failed", error);

    return NextResponse.json(
      { success: false, error: "Could not load automation settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const parsed = parseCustomerAutomationPatch(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const context = await getAuthContext();

    if ("error" in context) {
      return context.error;
    }

    const currentSettings = await ensureSettings(
      context.supabase,
      context.businessId
    );

    const updates: Record<string, unknown> = {
      ...parsed.value,
    };

    const recurringEnabled =
      parsed.value.recurring_scans_enabled ??
      currentSettings.recurring_scans_enabled;

    const reportFrequency =
      parsed.value.report_frequency ?? currentSettings.report_frequency;

    const timezone = parsed.value.timezone ?? currentSettings.timezone;

    if (recurringEnabled && reportFrequency === "manual") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose weekly, biweekly, or monthly before enabling recurring scans.",
        },
        { status: 400 }
      );
    }

    const shouldReschedule =
      recurringEnabled &&
      (parsed.value.recurring_scans_enabled === true ||
        "report_frequency" in parsed.value ||
        "timezone" in parsed.value ||
        !currentSettings.next_scan_at);

    if (shouldReschedule) {
      const nextScanAt = calculateNextScanAt(
        reportFrequency,
        new Date(),
        timezone
      );

      updates.next_scan_at = nextScanAt?.toISOString() ?? null;
    }

    if ("onboarding_status" in parsed.value) {
      updates.onboarding_completed_at =
        parsed.value.onboarding_status === "ready"
          ? new Date().toISOString()
          : null;
    }

    if (parsed.value.recurring_scans_enabled === false) {
      updates.next_scan_at = null;
    }

    const { data, error } = await context.supabase
      .from("customer_automation_settings")
      .update(updates)
      .eq("business_id", context.businessId)
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Could not update automation settings: ${error.message}`
      );
    }

    return NextResponse.json(
      { success: true, settings: data },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("customer-automation.settings.patch.failed", error);

    return NextResponse.json(
      { success: false, error: "Could not update automation settings." },
      { status: 500 }
    );
  }
}
