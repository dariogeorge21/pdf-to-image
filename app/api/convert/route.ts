import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds (Vercel hobby: 10s, pro: 60s)

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
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Dynamic import to avoid issues with SSR/edge bundling
    const { pdf } = await import("pdf-to-img");
    const JSZip = (await import("jszip")).default;

    // Convert each page to a PNG Buffer at 300 DPI (scale ≈ 300/72 ≈ 4.17)
    const SCALE = 300 / 72;
    const document = await pdf(pdfBuffer, { scale: SCALE });
    const pageCount = document.length;

    // ── 3. Build ZIP ──────────────────────────────────────────────────────
    const zip = new JSZip();
    const imagesFolder = zip.folder("pages");

    if (!imagesFolder) {
      throw new Error("Failed to create ZIP folder.");
    }

    let pageIndex = 0;
    for await (const pageImage of document) {
      pageIndex++;
      const paddedNum = String(pageIndex).padStart(
        String(pageCount).length,
        "0"
      );
      imagesFolder.file(`page_${paddedNum}.png`, pageImage);
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
