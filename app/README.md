# OCR Pipeline Web Interface

Web application for the Vietnamese document OCR pipeline. Upload PDF documents and get structured markdown output.

## Architecture

- **Backend**: FastAPI (Python) - Handles PDF uploads, converts to images, runs OCR pipeline
- **Frontend**: React + TypeScript + Vite - User interface for file upload and results display
- **Styling**: Tailwind CSS
- **Icons**: lucide-react

## Prerequisites

- Python 3.10+ with `ocr` conda environment activated
- Node.js 18+ and npm
- CUDA 12.1+ with GPU (for OCR processing)

## Setup

### Backend Setup

1. Install Python dependencies:
```bash
cd app
pip install -r requirements.txt
```

### Frontend Setup

1. Install Node.js dependencies:
```bash
cd app/frontend
npm install
```

## Running the Application

### Start Backend Server

From the project root:
```bash
# Make sure ocr conda environment is activated
conda activate ocr

# Start FastAPI server
uvicorn app.server:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Start Frontend Dev Server

In a separate terminal:
```bash
cd app/frontend
npm run dev
```

The web app will be available at: http://localhost:5173

## Usage

1. Open http://localhost:5173 in your browser
2. Upload a PDF document (max 10MB)
3. Wait for processing (converts PDF → images → OCR → markdown)
4. View, copy, or download the markdown output

## API Endpoints

### `GET /api/health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "message": "OCR Pipeline API is running"
}
```

### `POST /api/upload`
Upload and process PDF document

**Request:**
- Content-Type: `multipart/form-data`
- Body: PDF file

**Response:**
```json
{
  "success": true,
  "markdown": "# Document Content\n...",
  "page_count": 3,
  "processing_time": 45.2,
  "session_id": "uuid",
  "error": null
}
```

## Project Structure

```
app/
├── server.py              # FastAPI backend
├── __init__.py           # Python package init
├── requirements.txt      # Backend dependencies
├── uploads/              # Temporary upload directory
│   └── .gitignore
└── frontend/
    ├── src/
    │   ├── App.tsx                    # Main app component
    │   ├── main.tsx                   # Entry point
    │   ├── index.css                  # Tailwind imports
    │   ├── api/
    │   │   └── client.ts              # API client
    │   └── components/
    │       ├── FileUpload.tsx         # PDF upload interface
    │       ├── ProcessingStatus.tsx   # Processing feedback
    │       ├── MarkdownViewer.tsx     # Results display
    │       └── ErrorDisplay.tsx       # Error handling
    ├── package.json
    ├── vite.config.ts                 # Vite config with proxy
    ├── tailwind.config.js
    └── postcss.config.js
```

## Development Notes

- Backend runs on port 8000
- Frontend dev server runs on port 5173
- Vite proxy forwards `/api/*` requests to backend
- Temp files are automatically cleaned up after processing
- CORS is configured for localhost:5173

## Troubleshooting

**Backend won't start:**
- Ensure `ocr` conda environment is activated
- Check that all Python dependencies are installed
- Verify GPU is available: `python -c "import torch; print(torch.cuda.is_available())"`

**Frontend won't start:**
- Run `npm install` in `app/frontend`
- Check Node.js version: `node --version` (should be 18+)

**Upload fails:**
- Check file is PDF format
- Ensure file size is under 10MB
- Verify backend is running on port 8000

**Processing fails:**
- Check backend logs for errors
- Ensure pipeline models exist: `Layout/layout.pt`, `OCR/transformerocr.pth`
- Verify GPU memory is sufficient (minimum 2GB VRAM)
