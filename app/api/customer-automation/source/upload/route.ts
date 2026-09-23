import { dispatchAutomaticCustomerAnalysis } from "../../../../lib/customer-automation/automatic-analysis";
import { del, head } from "@vercel/blob";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { appConfig } from "../../../../lib/config/app-config";

export const dynamic = "force-dynamic";

type UploadTokenPayload = {
  userId: string;
  businessId: string;
  fileName: string;
};

function safeFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return normalized || "business-data.csv";
}

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

function createWorkerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Supabase worker configuration is missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid upload request." },
      { status: 400 }
    );
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const supabase = await createAuthenticatedSupabase();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Authentication required.");
        }

        const { data: business, error: businessError } = await supabase
          .from("businesses")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (businessError) {
          throw new Error(`Could not load business: ${businessError.message}`);
        }

        if (!business?.id) {
          throw new Error("No business found for this account.");
        }

        let parsedPayload: { fileName?: unknown } = {};

        if (clientPayload) {
          try {
            parsedPayload = JSON.parse(clientPayload) as {
              fileName?: unknown;
            };
          } catch {
            throw new Error("Invalid upload payload.");
          }
        }

        const requestedFileName =
          typeof parsedPayload.fileName === "string"
            ? parsedPayload.fileName
            : "";

        const fileName = safeFileName(requestedFileName);

        if (!fileName.toLowerCase().endsWith(".csv")) {
          throw new Error("Recurring scan source must be a CSV file.");
        }

        const prefix = `customer-scan-sources/${business.id}/`;

        if (!pathname.startsWith(prefix)) {
          throw new Error("Invalid recurring scan upload path.");
        }

        const suffix = pathname.slice(prefix.length);

        if (
          !suffix ||
          suffix.includes("/") ||
          suffix.includes("\\") ||
          suffix.includes("..") ||
          !suffix.toLowerCase().endsWith(".csv")
        ) {
          throw new Error("Invalid recurring scan upload filename.");
        }

        return {
          allowedContentTypes: [
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
            "text/plain",
          ],
          maximumSizeInBytes: appConfig.limits.maxUploadMb * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            userId: user.id,
            businessId: business.id,
            fileName,
          } satisfies UploadTokenPayload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let trusted: UploadTokenPayload;

        try {
          trusted = JSON.parse(tokenPayload ?? "") as UploadTokenPayload;
        } catch {
          await del(blob.pathname).catch(() => undefined);
          throw new Error("Invalid trusted upload payload.");
        }

        if (
          !trusted.userId ||
          !trusted.businessId ||
          !trusted.fileName ||
          !blob.pathname.startsWith(
            `customer-scan-sources/${trusted.businessId}/`
          )
        ) {
          await del(blob.pathname).catch(() => undefined);
          throw new Error("Recurring scan upload validation failed.");
        }

        const worker = createWorkerSupabase();

        const { data: business, error: businessError } = await worker
          .from("businesses")
          .select("id,user_id")
          .eq("id", trusted.businessId)
          .eq("user_id", trusted.userId)
          .maybeSingle();

        if (businessError || !business) {
          await del(blob.pathname).catch(() => undefined);
          throw new Error("Recurring scan source ownership check failed.");
        }

        const { data: automation, error: automationError } =
      await worker
        .from("customer_automation_settings")
        .select("active_job_id")
        .eq("business_id", trusted.businessId)
        .maybeSingle();

    if (automationError) {
      await del(blob.pathname).catch(() => undefined);

      throw new Error(
        `Could not check recurring scan activity: ${automationError.message}`
      );
    }

    if (automation?.active_job_id) {
      await del(blob.pathname).catch(() => undefined);

      throw new Error(
        "A recurring scan is currently running. Try replacing the CSV after it finishes."
      );
    }

    const { data: previous, error: previousError } = await worker
          .from("customer_scan_sources")
          .select("source_path")
          .eq("business_id", trusted.businessId)
          .maybeSingle();

        if (previousError) {
          await del(blob.pathname).catch(() => undefined);
          throw new Error(
            `Could not read previous scan source: ${previousError.message}`
          );
        }

        const storedBlob = await head(blob.pathname);
    const maxUploadBytes = appConfig.limits.maxUploadMb * 1024 * 1024;

    if (
      !Number.isFinite(storedBlob.size) ||
      storedBlob.size <= 0 ||
      storedBlob.size > maxUploadBytes
    ) {
      await del(blob.pathname).catch(() => undefined);
      throw new Error(
        `Recurring scan CSV must be between 1 byte and ${appConfig.limits.maxUploadMb} MB.`
      );
    }

    const { error: upsertError } = await worker
          .from("customer_scan_sources")
          .upsert(
            {
              business_id: trusted.businessId,
              source_path: blob.pathname,
              file_name: trusted.fileName,
              content_type: blob.contentType || "text/csv",
              size_bytes: storedBlob.size,
              mapping_overrides: {},
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: "business_id" }
          );

        if (upsertError) {
          await del(blob.pathname).catch(() => undefined);
          throw new Error(
            `Could not save recurring scan source: ${upsertError.message}`
          );
        }

        const { error: settingsError } = await worker
          .from("customer_automation_settings")
          .update({ data_status: "ready" })
          .eq("business_id", trusted.businessId);

        if (settingsError) {
          console.error(
            "customer-automation.source.settings-update.failed",
            settingsError
          );
        }

        const { data: savedSource, error: savedSourceError } =
          await worker
            .from("customer_scan_sources")
            .select("industry,mapping_overrides")
            .eq("business_id", trusted.businessId)
            .maybeSingle();

        if (savedSourceError) {
          throw new Error(
            `Could not reload automatic analysis source: ${savedSourceError.message}`
          );
        }

        const automaticAnalysis =
          await dispatchAutomaticCustomerAnalysis({
            businessId: trusted.businessId,
            sourcePath: blob.pathname,
            fileName: trusted.fileName,
            industry: savedSource?.industry ?? null,
            mappingOverrides:
              savedSource?.mapping_overrides ?? {},
          });

        console.info(
          "customer-automation.source.analysis-dispatch",
          automaticAnalysis
        );


        if (previous?.source_path && previous.source_path !== blob.pathname) {
          try {
            await del(previous.source_path);
          } catch (cleanupError) {
            console.error(
              "customer-automation.source.previous-blob-cleanup.failed",
              cleanupError
            );
          }
        }
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recurring scan upload failed.";

    console.error("customer-automation.source.upload.failed", error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
