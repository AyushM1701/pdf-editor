# PDF Editor & AI Extractor 

A full-featured, browser-based PDF editor with an optional AI-powered data extraction backend. Edit, annotate, sign, redact, and merge PDFs — all locally in your browser. When you need AI muscle, the FastAPI backend handles OCR and structured extraction via Google Gemini.

---

## Features

### Local Editor (No Backend Required)
- **Merge & Reorder** — Drag-and-drop multiple PDFs, reorder pages with a staging area
- **Split & Delete** — Remove pages or export subsets
- **Rotate & Crop** — Rotate pages 90° and visually crop
- **Duplicate Pages** — Clone any page with all annotations intact
- **Text Annotations** — Add, position, and style text overlays
- **Freehand Drawing** — Pen, highlighter, rectangles, circles
- **Signatures** — Draw or upload a signature image and stamp it onto pages
- **Form Filling** — Detect and fill AcroForm fields (text, checkbox, radio, dropdown)
- **Search & Find** — Full-text search across all pages with visual highlighting
- **Metadata Editor** — Edit PDF title, author, subject, and keywords
- **Export Options** — Quick export or use the advanced dialog for:
  - Password encryption (AES-256) with granular permissions
  - Compression & optimization (image downscaling, garbage collection)
  - Cryptographic digital signatures (self-signed X.509 via pyHanko)
  - True redaction (permanently destroys underlying text via PyMuPDF)

### AI Extraction (Backend Required)
- **Document Classification** — Automatically identify document type (invoice, ID, receipt, etc.)
- **Structured Extraction** — Extract key-value pairs with confidence scores
- **Document Summary** — Generate a comprehensive summary of the document
- **Search AI Results** — Filter and highlight within extracted fields
- **Export Results** — Download extracted data as JSON or CSV

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v4, pdf-lib, pdfjs-dist, lucide-react |
| **Backend** | Python 3.11+, FastAPI, PyMuPDF (fitz), pyHanko, arq + Redis |
| **AI** | Google Gemini, EasyOCR, Hugging Face Transformers |
| **Storage** | Local filesystem (default) or AWS S3 |
| **Deployment** | Docker Compose (Nginx + FastAPI + Redis) |

---

## Quick Start

### Prerequisites

| Tool | Version | Required For |
|---|---|---|
| **Node.js** | 20+ | Frontend |
| **Python** | 3.11+ (3.11 recommended) | Backend |
| **Redis** | 7+ | Backend (AI extraction queue) |
| **Docker** | Latest | Docker deployment (optional) |

> **Note:** Python 3.13 works but some ML libraries (EasyOCR, Transformers) don't have wheel support yet, so AI features may be limited.

---

### Option A: Local Development (Recommended for first-time setup)

#### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/pdf-editor.git
cd pdf-editor
```

#### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create your environment file
cp .env.example .env   # Linux/macOS
# or
Copy-Item .env.example .env   # Windows PowerShell
```

Edit `backend/.env` and configure:

```env
# Required for AI extraction — get a free key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your_key_here

# Keep True for local development (no AWS needed)
USE_LOCAL_STORAGE=True
```

Start the API server:

```bash
uvicorn app.main:app --reload --host localhost --port 8000
```

> **Redis Required for AI Extraction:** The backend needs Redis for the background job queue. Install Redis locally or run `docker run -d -p 6379:6379 redis:7-alpine`. If you only need local PDF editing (no AI), you can skip Redis, but the server will fail to start without it. See Option B for the easiest full-stack setup.

If using Redis, start the background worker in a separate terminal:

```bash
cd backend
.venv/Scripts/Activate.ps1   # or source .venv/bin/activate
arq app.worker.WorkerSettings
```

#### 3. Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

### Option B: Docker Compose (Easiest full-stack setup)

This starts the frontend, backend, Redis, and background worker with a single command.

```bash
# From the project root:
cp backend/.env.example backend/.env
# Edit backend/.env with your GEMINI_API_KEY if you want AI features

docker compose up --build
```

Once running:
- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:8000

To stop:
```bash
docker compose down
```

---

## Configuration

All backend configuration is done through `backend/.env`. Here's what each setting does:

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(empty)* | Google Gemini API key for AI extraction |
| `USE_LOCAL_STORAGE` | `True` | Use local filesystem instead of AWS S3 |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed frontend origins (JSON array) |
| `API_KEY` | *(empty)* | Set to require `X-API-Key` header on all requests |
| `AWS_REGION` | `us-east-1` | AWS region (only if `USE_LOCAL_STORAGE=False`) |
| `S3_BUCKET_NAME` | `hybrid-pdf-documents` | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | *(empty)* | AWS credentials (or use `aws configure`) |
| `AWS_SECRET_ACCESS_KEY` | *(empty)* | AWS credentials |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MAX_UPLOAD_BYTES` | `52428800` (50MB) | Maximum upload file size |

### Storage: Local vs AWS S3

- **Local (default):** Files are saved to `backend/local_uploads/`. No cloud credentials needed.
- **AWS S3:** Set `USE_LOCAL_STORAGE=False` and configure AWS credentials. Run `python setup_s3.py` to auto-create your bucket with proper CORS policies.

---

## Project Structure

```
pdf-editor/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # FastAPI endpoints (extraction, storage, tools)
│   │   ├── core/            # Config, auth, rate limiting, error handlers
│   │   ├── ml/              # AI/ML services (Gemini, OCR, document understanding)
│   │   ├── schemas/         # Pydantic models
│   │   ├── services/        # Business logic (extraction, S3, local storage)
│   │   ├── main.py          # FastAPI app entry point
│   │   └── worker.py        # arq background worker for AI jobs
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # API client (apiClient.js)
│   │   ├── components/      # React UI components
│   │   ├── context/         # React context (PdfContext)
│   │   ├── features/        # Feature modules (AI extraction, conversions)
│   │   ├── hooks/           # Custom hooks (useLocalPDF, usePdf, useUndoRedo)
│   │   ├── pages/           # Route pages
│   │   ├── schemas/         # Validation schemas
│   │   ├── styles/          # CSS
│   │   ├── utils/           # Utilities (download, PDF.js helpers, conversions)
│   │   └── workers/         # Web Workers (PDF export)
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.js
├── docker-compose.yml
├── LICENSE
└── README.md
```

---

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/storage/presign-upload` | Get presigned upload URL |
| `PUT` | `/api/storage/local-upload/{key}` | Direct local file upload |
| `POST` | `/api/extraction/run` | Start AI extraction job |
| `GET` | `/api/extraction/status/{job_id}` | Poll job status |
| `GET` | `/api/extraction/stream/{job_id}` | SSE stream for real-time updates |
| `POST` | `/api/extraction/batch-run` | Batch extraction (max 3) |
| `POST` | `/api/tools/decrypt` | Decrypt a password-protected PDF |
| `POST` | `/api/tools/encrypt` | Encrypt a PDF with AES-256 |
| `POST` | `/api/tools/optimize` | Compress and optimize a PDF |
| `POST` | `/api/tools/sign` | Cryptographically sign a PDF |
| `POST` | `/api/tools/redact` | Apply true redactions to a PDF |

---

## Troubleshooting

### Frontend can't connect to backend
- Verify the backend is running on `http://localhost:8000`
- Check that `CORS_ORIGINS` in `backend/.env` includes your frontend URL
- Check the browser console for CORS errors

### AI extraction doesn't work
- Ensure Redis is running (`redis-cli ping` should return `PONG`)
- Ensure the arq worker is running (`arq app.worker.WorkerSettings`)
- Verify `GEMINI_API_KEY` is set in `backend/.env`

### "Module not found" errors on backend startup
- Make sure you installed all dependencies: `pip install -r requirements.txt`
- Use Python 3.11 for full ML library support

### Presigned upload fails (S3 mode)
- Verify AWS credentials are available to the backend
- Check that `S3_BUCKET_NAME` exists and has proper IAM permissions
- Run `python setup_s3.py` to auto-configure the bucket

---

## Development

### Frontend production build
```bash
cd frontend
npm run build
```

### Backend syntax check
```bash
cd backend
python -m compileall app
```

### Run frontend tests
```bash
cd frontend
npm test
```

---

## 📄 License

[MIT](LICENSE)
