# PDF → Images Converter

A minimal, polished **Next.js 14 App Router** app that converts every page of a PDF into a high-resolution PNG image (300 DPI) and bundles them into a downloadable ZIP archive.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 14 (App Router) |
| PDF → PNG | `pdf-to-img` (wraps pdfjs-dist + canvas) |
| ZIP bundling | `jszip` |
| Styling | CSS Modules (Soft UI / Minimalist) |
| Font | DM Sans + DM Mono (Google Fonts) |

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- On Linux/macOS you may need the `canvas` native addon dependencies:
  ```bash
  # Ubuntu / Debian
  sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev

  # macOS (Homebrew)
  brew install pkg-config cairo pango libpng jpeg giflib librsvg
  ```

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
pdf-to-img-converter/
├── app/
│   ├── globals.css          # CSS custom properties + resets
│   ├── layout.tsx           # Root layout (Google Fonts, metadata)
│   ├── page.tsx             # Main UI (drag-drop, preview, download)
│   ├── page.module.css      # Scoped CSS Modules
│   └── api/
│       └── convert/
│           └── route.ts     # POST handler → PDF→PNG→ZIP pipeline
├── next.config.js           # serverComponentsExternalPackages for canvas
├── package.json
└── tsconfig.json
```

---

## API Reference

### `POST /api/convert`

**Request:** `multipart/form-data` with a `file` field (PDF, max 10 MB).

**Response:** Binary ZIP archive (`application/zip`).

| Header | Description |
|---|---|
| `Content-Type` | `application/zip` |
| `Content-Disposition` | `attachment; filename="<name>_images.zip"` |
| `X-Page-Count` | Number of pages converted |

**Error responses** are JSON: `{ "error": "..." }`.

---

## Limitations

- Max file size: **10 MB**
- Only **PDF** files are accepted
- Serverless timeout: 60 s (adjust `maxDuration` in the route file)
- PDF rendering uses the system's canvas library — ensure native deps are installed

---

## Deployment Notes

### Vercel

Add a `vercel.json` to increase the function timeout if needed:

```json
{
  "functions": {
    "app/api/convert/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### Docker

If deploying in a container, ensure `canvas` system dependencies are included in the Dockerfile.
