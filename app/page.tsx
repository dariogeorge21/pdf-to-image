"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./page.module.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ConversionState = "idle" | "converting" | "done" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [conversionState, setConversionState] = useState<ConversionState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [previewUrl, downloadUrl]);

  const applyFile = useCallback((incoming: File) => {
    if (incoming.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    if (incoming.size > MAX_FILE_SIZE) {
      setError(`File exceeds the 10 MB limit (${formatBytes(incoming.size)}).`);
      return;
    }
    setError(null);
    setConversionState("idle");
    setDownloadUrl(null);
    setPageCount(null);
    setFile(incoming);
    const url = URL.createObjectURL(incoming);
    setPreviewUrl(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) applyFile(dropped);
    },
    [applyFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) applyFile(selected);
  };

  const handleRemove = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setConversionState("idle");
    setError(null);
    setDownloadUrl(null);
    setPageCount(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleConvert = async () => {
    if (!file) return;
    setConversionState("converting");
    setProgress(10);
    setProgressMsg("Uploading PDF…");
    setError(null);
    setDownloadUrl(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);
      setProgressMsg("Sending to converter…");

      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      setProgress(70);
      setProgressMsg("Receiving ZIP…");

      if (!res.ok) {
        const { error: msg } = (await res.json().catch(() => ({ error: "Conversion failed." })));
        throw new Error(msg || "Conversion failed.");
      }

      // Extract page count from header if available
      const pages = res.headers.get("X-Page-Count");
      if (pages) setPageCount(parseInt(pages, 10));

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setProgress(100);
      setProgressMsg("Done!");
      setDownloadUrl(url);
      setConversionState("done");
    } catch (err: unknown) {
      setConversionState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleDownload = () => {
    if (!downloadUrl || !file) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = file.name.replace(/\.pdf$/i, "") + "_images.zip";
    a.click();
  };

  const isConverting = conversionState === "converting";

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="white" strokeWidth="1.5" />
              <path d="M5 7h5M5 9.5h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="8" y="8" width="6" height="6" rx="1" fill="white" />
              <path d="M10 11l1.5 1.5L13 10" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className={styles.logoText}>PDF → Images</span>
        </div>
        <span className={styles.badge}>300 DPI · PNG</span>
      </header>

      {/* Main */}
      <main className={styles.main}>
        {/* Hero */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Convert PDF pages
            <br />
            <span>to crisp images</span>
          </h1>
          <p className={styles.heroDesc}>
            Upload a PDF and download all pages as high-resolution PNG images,
            bundled in a ZIP archive. Up to 10 MB.
          </p>
        </div>

        {/* Drop Zone */}
        {!file && (
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            aria-label="Upload PDF file"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className={styles.fileInput}
              onChange={handleInputChange}
              aria-hidden="true"
            />
            <div className={styles.dropZoneContent}>
              <div className={styles.dropIcon}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 14V4M7 8l4-4 4 4" />
                  <path d="M3 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                </svg>
              </div>
              <div className={styles.dropLabel}>
                <span className={styles.dropPrimary}>
                  Drop your PDF here, or <strong>browse</strong>
                </span>
                <span className={styles.dropSecondary}>PDF only · max 10 MB</span>
              </div>
            </div>
          </div>
        )}

        {/* File Info Row */}
        {file && (
          <div className={styles.fileInfo}>
            <div className={styles.fileIcon}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="1" width="11" height="16" rx="2" />
                <path d="M5 7h6M5 10h4" strokeLinecap="round" />
                <rect x="9" y="9" width="7" height="7" rx="1.5" fill="white" stroke="currentColor" />
                <path d="M11 12.5l1.5 1.5L15 11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className={styles.fileMeta}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileSize}>{formatBytes(file.size)}</div>
            </div>
            <button
              className={styles.removeBtn}
              onClick={handleRemove}
              title="Remove file"
              aria-label="Remove file"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>
        )}

        {/* PDF Preview */}
        {previewUrl && (
          <div className={styles.previewSection}>
            <span className={styles.sectionLabel}>Preview</span>
            <div className={styles.pdfPreview}>
              <object
                data={previewUrl}
                type="application/pdf"
                width="100%"
                height="100%"
                aria-label="PDF preview"
              >
                <iframe
                  src={previewUrl}
                  title="PDF preview"
                  width="100%"
                  height="100%"
                />
              </object>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <svg className={styles.errorIcon} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0V9a.75.75 0 00-1.5 0v4.25zm.75-7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className={styles.errorText}>{error}</span>
          </div>
        )}

        {/* Actions */}
        {file && conversionState !== "done" && (
          <div className={styles.actions}>
            <button
              className={`${styles.generateBtn} ${isConverting ? styles.loading : ""}`}
              onClick={handleConvert}
              disabled={isConverting}
              aria-busy={isConverting}
            >
              {isConverting ? (
                <>
                  <span className={styles.btnSpinner} aria-hidden="true" />
                  Converting…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="2" width="9" height="12" rx="1.5" />
                    <path d="M5 6h4M5 9h2" />
                    <path d="M10 9l2 2 3-3" />
                  </svg>
                  Generate Images
                </>
              )}
            </button>

            {/* Progress */}
            {isConverting && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className={styles.progressText}>{progressMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* Success Banner + Download */}
        {conversionState === "done" && downloadUrl && (
          <>
            <div className={styles.successBanner}>
              <div className={styles.successIcon}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 7l3.5 3.5L12 3" />
                </svg>
              </div>
              <div className={styles.successText}>
                <div className={styles.successTitle}>
                  Conversion complete{pageCount ? ` — ${pageCount} page${pageCount !== 1 ? "s" : ""}` : ""}!
                </div>
                <div className={styles.successSub}>Your ZIP is ready to download</div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.generateBtn} onClick={handleDownload}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
                </svg>
                Download ZIP
              </button>
              <button
                style={{
                  background: "none",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 32px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-sans)",
                  transition: "all 0.15s ease",
                }}
                onClick={handleRemove}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                Convert another
              </button>
            </div>
          </>
        )}

        {/* Info strip */}
        {!file && (
          <div className={styles.infoStrip}>
            <div className={styles.infoItem}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M7 6v4M7 4.5v.5" />
              </svg>
              300 DPI output
            </div>
            <div className={styles.infoDivider} />
            <div className={styles.infoItem}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="1.5" y="2" width="11" height="10" rx="1.5" />
                <path d="M4.5 5.5h5M4.5 8h3" />
              </svg>
              All pages converted
            </div>
            <div className={styles.infoDivider} />
            <div className={styles.infoItem}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M2 4.5L7 2l5 2.5v5L7 12 2 9.5v-5z" />
                <path d="M7 2v10M2 4.5l5 2.5 5-2.5" />
              </svg>
              Bundled as ZIP
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        Built with Next.js · pdf-to-img · JSZip
      </footer>
    </div>
  );
}
