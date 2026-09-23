"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";

type SourceMetadata = {
  business_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  industry: string | null;
  uploaded_at: string;
  updated_at: string;
};

type SourceResponse = {
  success: boolean;
  businessId?: string;
  source?: SourceMetadata | null;
  error?: string;
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

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  const size = value / Math.pow(1024, index);

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function PersistentScanSourceCard({
  onSourceReady,
}: {
  onSourceReady?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [source, setSource] = useState<SourceMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSource() {
    const response = await fetch("/api/customer-automation/source", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    const payload = (await response.json()) as SourceResponse;

    if (!response.ok || !payload.success || !payload.businessId) {
      throw new Error(
        payload.error || "Could not load recurring scan source."
      );
    }

    setBusinessId(payload.businessId);
    setSource(payload.source ?? null);

    return payload.source ?? null;
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/customer-automation/source", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const payload = (await response.json()) as SourceResponse;

        if (!response.ok || !payload.success || !payload.businessId) {
          throw new Error(
            payload.error || "Could not load recurring scan source."
          );
        }

        if (!cancelled) {
          setBusinessId(payload.businessId);
          setSource(payload.source ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load recurring scan source."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(file: File) {
    setMessage("");
    setError("");

    if (!businessId) {
      setError("Business information is not ready yet.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Recurring scan source must be a CSV file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("CSV must be 10 MB or smaller.");
      return;
    }

    setUploading(true);

    try {
      const cleanName = safeFileName(file.name);
      const uniqueName = `${crypto.randomUUID()}-${cleanName}`;
      const pathname = `customer-scan-sources/${businessId}/${uniqueName}`;

      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/customer-automation/source/upload",
        clientPayload: JSON.stringify({
          fileName: cleanName,
        }),
      });

      let updated: SourceMetadata | null = null;

      for (let attempt = 1; attempt <= 12; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          updated = await loadSource();
        } catch {
          updated = null;
        }

        if (
          updated &&
          updated.file_name === cleanName &&
          new Date(updated.updated_at).getTime() >= Date.now() - 60_000
        ) {
          break;
        }
      }

      if (!updated || updated.file_name !== cleanName) {
        throw new Error(
          "Upload finished, but the recurring scan source is still processing. Refresh this page in a moment."
        );
      }

      setSource(updated);
      onSourceReady?.();
      setMessage(
        source
          ? "Recurring scan CSV replaced successfully."
          : "Recurring scan CSV saved successfully."
      );

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload recurring scan CSV."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid rgba(127,127,127,.28)",
        borderRadius: 18,
        padding: 22,
        marginBottom: 18,
        background: "rgba(127,127,127,.05)",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}>
        Recurring scan data
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: 18,
          opacity: 0.7,
          lineHeight: 1.6,
        }}
      >
        Save one private CSV as the source for future automatic scans. Replacing
        it updates the recurring source without changing your historical
        analyses.
      </p>

      {loading ? (
        <div style={{ opacity: 0.7 }}>Loading scan source...</div>
      ) : (
        <>
          {source ? (
            <div
              style={{
                border: "1px solid rgba(127,127,127,.28)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <strong style={{ display: "block", marginBottom: 5 }}>
                {source.file_name}
              </strong>

              <div style={{ opacity: 0.68, fontSize: 14, lineHeight: 1.6 }}>
                <div>{formatBytes(source.size_bytes)}</div>
                <div>
                  Updated {new Date(source.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: "1px dashed rgba(127,127,127,.4)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                opacity: 0.72,
              }}
            >
              No recurring scan CSV has been saved yet.
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
            style={{ display: "none" }}
          />

          <button
            type="button"
            disabled={uploading || !businessId}
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%",
              borderRadius: 12,
              padding: "13px 16px",
              fontWeight: 700,
              cursor:
                uploading || !businessId ? "not-allowed" : "pointer",
              opacity: uploading || !businessId ? 0.55 : 1,
            }}
          >
            {uploading
              ? "Uploading private CSV..."
              : source
                ? "Replace recurring scan CSV"
                : "Upload recurring scan CSV"}
          </button>

          {message ? (
            <div style={{ marginTop: 12 }}>
              <strong>{message}</strong>
            </div>
          ) : null}

          {error ? (
            <div style={{ marginTop: 12 }}>
              <strong>Upload error:</strong> {error}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
