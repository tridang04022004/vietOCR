# Vietnamese OCR Pipeline

End-to-end document OCR pipeline for Vietnamese documents with both:

- a CLI processing flow
- a web interface (FastAPI + React + TypeScript)

The pipeline extracts structured markdown from scanned documents and PDFs using layout detection, line/table extraction, and OCR.

## Prerequisites

- CUDA 12.1 installed
- NVIDIA GPU (minimum 2 GB VRAM)
- Anaconda or Miniconda
- Python 3.10
- Node.js 18+ and npm

## Model Weights Placement (After Unzip)

Unzip model weights and place each file in the exact folder below.
Do not rename the files.

| Weight file          | Put in folder  | Final path                  |
| -------------------- | -------------- | --------------------------- |
| `layout.pt`          | `layout/`      | `layout/layout.pt`          |
| `table.pt`           | `table/`       | `table/table.pt`            |
| `transformerocr.pth` | `ocr/`         | `ocr/transformerocr.pth`    |
| `best_model.pt`      | `autoCorrect/` | `autoCorrect/best_model.pt` |

## 1) Core Environment Setup

```bash
# From project root
conda create -n ocr python=3.10 -y
conda activate ocr

# Build tools
pip install "setuptools>=65.5.0" patch-ng==1.17.4

# PyTorch (CUDA 12.1)
pip install torch==2.5.1+cu121 torchvision==0.20.1+cu121 torchaudio==2.5.1+cu121 --index-url https://download.pytorch.org/whl/cu121

# Project dependencies
pip install --no-build-isolation --only-binary=matplotlib -r requirements.txt
```

Verify environment:

```bash
python test_environment.py
```

Expected checks should pass for Python, dependencies, GPU support, model files, and pipeline script.

## 2) Run the OCR Pipeline (CLI)

```bash
python pipeline.py --input document.png --output results/
```

Output is written under `results/<doc_name>/<timestamp>/` and typically includes:

- `output.md`
- `results.json`
- `intermediate/` debug artifacts

## 3) Setup Web Application

### Backend dependencies

```bash
conda activate ocr
cd app
pip install -r requirements.txt
cd ..
```

### Frontend dependencies

```bash
cd app/frontend
npm install
cd ../..
```

## 4) Start Web Application

### Start backend

```bash
# From project root
conda activate ocr
python -m uvicorn app.server:app --reload --port 8000
```

Backend endpoints:

- API base: http://localhost:8000
- Interactive docs: http://localhost:8000/docs

### Start frontend (new terminal)

```bash
cd app/frontend
npm run dev
```

Frontend URL:

- http://localhost:5173

## 5) Web Usage

1. Upload a PDF (drag and drop or browse).
2. Wait for processing to complete.
3. Preview extracted markdown.
4. Copy or download `.md` output.

## Web Features

- Drag-and-drop PDF upload
- Progress and processing status
- Markdown preview
- Error handling and retry
- Multi-page PDF support

## Project Structure (high level)

```text
app/
  server.py                 FastAPI backend
  requirements.txt          Backend dependencies
  frontend/                 React + TypeScript frontend
layout/                     Document layout detection
line/                       Text line segmentation
table/                      Table extraction
ocr/                        OCR model and inference
pipeline.py                 Main orchestration script
```

## Troubleshooting

Issue: `ModuleNotFoundError: No module named 'pkg_resources'`

- Fix: `pip install --upgrade setuptools`

Issue: Backend does not start

- Ensure `ocr` environment is active
- Check CUDA/GPU availability:

```bash
python -c "import torch; print(torch.cuda.is_available())"
```

Issue: Frontend module errors

- Reinstall frontend dependencies:

```bash
cd app/frontend
npm install
```

Issue: Upload fails

- Confirm backend is running at port 8000
- Confirm file is a valid PDF and within size limits
- Check backend terminal logs for details

Issue: CUDA out-of-memory on smaller GPUs

- Reduce input resolution or process smaller batches/documents

## Notes

- Keep model weights local (already ignored in `.gitignore`).
- Local instruction/config files (`CLAUDE.md`, `.claude/`) are ignored.
