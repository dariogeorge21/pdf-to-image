import { NextRequest, NextResponse } from "next/server";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds (Vercel hobby: 10s, pro: 60s)

type CanvasModule = typeof import("@napi-rs/canvas");

function installCanvasGlobals(canvasModule: CanvasModule) {
  const globalScope = globalThis as any;

  if (globalScope.DOMMatrix == null) {
    globalScope.DOMMatrix = canvasModule.DOMMatrix;
  }

  if (globalScope.ImageData == null) {
    globalScope.ImageData = canvasModule.ImageData;
  }

  if (globalScope.Path2D == null) {
    globalScope.Path2D = canvasModule.Path2D;
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse multipart form data ──────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if ((file as File).type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted." },
        { status: 415 }
      );
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 10 MB limit." },
        { status: 413 }
      );
    }

    // ── 2. Convert buffer ─────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = new Uint8Array(arrayBuffer);

    // Keep NAPI canvas as dynamic import to preserve native binary loading behavior
    const canvasModule = await import("@napi-rs/canvas");
    installCanvasGlobals(canvasModule);

    // Provide the path to the standard fonts to prevent crashes on missing embedded fonts
    const standardFontDataUrl = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");

    // Convert each page to a PNG Buffer at 300 DPI (scale ≈ 300/72 ≈ 4.17)
    const SCALE = 300 / 72;
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBuffer,
      isEvalSupported: false,
      standardFontDataUrl,
    } as any);
    
    const document = await loadingTask.promise;
    const pageCount = document.numPages;

    // ── 3. Build ZIP ──────────────────────────────────────────────────────
    const zip = new JSZip();
    const imagesFolder = zip.folder("pages");

    if (!imagesFolder) {
      throw new Error("Failed to create ZIP folder.");
    }

    try {
      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
        const page = await document.getPage(pageIndex);

        try {
          const viewport = page.getViewport({ scale: SCALE });
          const canvas = canvasModule.createCanvas(
            Math.max(1, Math.ceil(viewport.width)),
            Math.max(1, Math.ceil(viewport.height))
          );
          const context = canvas.getContext("2d");

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          const renderTask = page.render({
            canvasContext: context as any,
            viewport,
          });

          await renderTask.promise;

          const paddedNum = String(pageIndex).padStart(
            String(pageCount).length,
            "0"
          );
          const pngBuffer = canvas.toBuffer("image/png");
          imagesFolder.file(`page_${paddedNum}.png`, pngBuffer);
        } finally {
          page.cleanup();
        }
      }
    } finally {
      await loadingTask.destroy();
      await document.destroy();
    }

    // ── 4. Generate and stream ZIP ────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const fileName =
      ((file as File).name ?? "document")
        .replace(/\.pdf$/i, "")
        .replace(/[^a-z0-9_\-]/gi, "_") + "_images.zip";

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(zipBuffer.length),
        "X-Page-Count": String(pageCount),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[/api/convert] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
