#!/usr/bin/env python3
"""
FastAPI backend for OCR Pipeline Web Interface
Handles PDF uploads, converts to images, and processes through pipeline
"""

import os
import sys
import shutil
import uuid
import time
import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

import fitz  # PyMuPDF
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

# Add parent directory to path to import pipeline
sys.path.insert(0, str(Path(__file__).parent.parent))
from runPipeline import runPipeline

# Import autoCorrect module
from autoCorrect.predictor import SpellingCorrector

# Import local modules (use relative imports for package compatibility)
from .database import init_db, get_db, User, Document
from .auth import hash_password, verify_password, create_access_token, get_current_user
from .models import (
    HealthResponse, ProcessingResponse, UserRegister, UserLogin,
    Token, UserResponse, DocumentResponse, DocumentDetailResponse, DocumentListResponse,
    DocumentUpdateRequest, ChangePasswordRequest, ChangeEmailRequest,
    AutoCorrectRequest, AutoCorrectResponse
)

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf"}
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Storage directory for persistent documents
STORAGE_DIR = Path(__file__).parent / "storage" / "documents"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Global singleton for spelling corrector (lazy-loaded)
_spelling_corrector: Optional[SpellingCorrector] = None

def get_spelling_corrector() -> SpellingCorrector:
    """Get or create spelling corrector singleton."""
    global _spelling_corrector

    if _spelling_corrector is None:
        print("[AutoCorrect] Loading spelling corrector...")
        module_dir = Path(__file__).parent.parent / "autoCorrect"
        checkpoint_path = str(module_dir / "best_model.pt")
        vocab_path = str(module_dir / "vocab.pkl")

        # Auto-detect device
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"

        _spelling_corrector = SpellingCorrector(
            checkpoint_path=checkpoint_path,
            vocab_path=vocab_path,
            device=device
        )
        print(f"[AutoCorrect] Corrector loaded on {device}")

    return _spelling_corrector

# ═══════════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="OCR Pipeline API",
    description="Vietnamese document OCR processing API",
    version="1.0.0",
    debug=True  # Enable debug mode to show detailed errors
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler to catch and log all errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and log them"""
    import traceback
    print(f"\n{'='*70}")
    print(f"UNHANDLED EXCEPTION in {request.method} {request.url.path}")
    print(f"{'='*70}")
    print(f"Exception type: {type(exc).__name__}")
    print(f"Exception message: {str(exc)}")
    print(f"\nFull traceback:")
    traceback.print_exc()
    print(f"{'='*70}\n")

    return JSONResponse(
        status_code=500,
        content={
            "detail": f"{type(exc).__name__}: {str(exc)}",
            "path": request.url.path
        }
    )

# ═══════════════════════════════════════════════════════════════════════════
# STARTUP EVENT
# ═══════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

# Models moved to models.py - imported at top

# ═══════════════════════════════════════════════════════════════════════════
# PDF PROCESSING
# ═══════════════════════════════════════════════════════════════════════════

def convert_pdf_to_images(pdf_path: str, output_dir: str) -> List[str]:
    """
    Convert PDF to PNG images using PyMuPDF.

    Args:
        pdf_path: Path to PDF file
        output_dir: Directory to save images

    Returns:
        List of image file paths
    """
    os.makedirs(output_dir, exist_ok=True)
    image_paths = []

    try:
        doc = fitz.open(pdf_path)

        for page_num in range(len(doc)):
            page = doc[page_num]

            # Render page to pixmap at 300 DPI
            mat = fitz.Matrix(300/72, 300/72)  # 300 DPI scaling
            pix = page.get_pixmap(matrix=mat)

            # Save as PNG
            image_path = os.path.join(output_dir, f"page_{page_num + 1:03d}.png")
            pix.save(image_path)
            image_paths.append(image_path)

        doc.close()
        return image_paths

    except Exception as e:
        raise Exception(f"PDF conversion failed: {str(e)}")

def process_pdf_pipeline(pdf_path: str, session_id: str) -> Dict:
    """
    Process PDF through OCR pipeline.

    Args:
        pdf_path: Path to uploaded PDF
        session_id: Unique session identifier

    Returns:
        Dict with markdown content, metadata, and visualization data
    """
    start_time = time.time()
    session_dir = UPLOAD_DIR / session_id
    images_dir = session_dir / "images"

    try:
        # Convert PDF to images
        print(f"[API] Converting PDF to images: {pdf_path}")
        image_paths = convert_pdf_to_images(pdf_path, str(images_dir))
        print(f"[API] Converted {len(image_paths)} pages")

        # Process each page through pipeline
        all_markdown = []
        all_corrected_markdown = []
        visualization_data = {}  # Store visualization data per page

        for idx, image_path in enumerate(image_paths):
            print(f"[API] Processing page {idx + 1}/{len(image_paths)}")

            # Run pipeline for this page
            # New pipeline creates: Output/{timestamp}/{timestamp}.md
            runPipeline(image_path)

            # Find the output markdown file in the Output directory
            output_base_dir = Path(__file__).parent.parent / "Output"

            if output_base_dir.exists():
                # Find the most recent timestamp directory
                timestamp_dirs = sorted(
                    [d for d in output_base_dir.iterdir() if d.is_dir()],
                    key=lambda x: x.stat().st_mtime
                )

                if timestamp_dirs:
                    latest_dir = timestamp_dirs[-1]
                    # Look for markdown file with timestamp name
                    markdown_files = list(latest_dir.glob("*.md"))

                    # Separate original and corrected markdown files
                    original_md = None
                    corrected_md = None

                    for md_file in markdown_files:
                        if "_corrected" in md_file.name:
                            corrected_md = md_file
                        else:
                            original_md = md_file

                    # Read original markdown
                    if original_md:
                        with open(original_md, "r", encoding="utf-8") as f:
                            page_markdown = f.read()

                        # Add page separator for multi-page documents
                        if len(image_paths) > 1:
                            all_markdown.append(f"# Page {idx + 1}\n\n{page_markdown}")
                        else:
                            all_markdown.append(page_markdown)

                    # Read corrected markdown
                    if corrected_md:
                        with open(corrected_md, "r", encoding="utf-8") as f:
                            page_corrected_markdown = f.read()

                        # Add page separator for multi-page documents
                        if len(image_paths) > 1:
                            all_corrected_markdown.append(f"# Page {idx + 1}\n\n{page_corrected_markdown}")
                        else:
                            all_corrected_markdown.append(page_corrected_markdown)

                    # Copy visualization data and original image to session directory
                    viz_file = latest_dir / "visualization.json"
                    orig_img = latest_dir / "original.png"

                    if viz_file.exists() and orig_img.exists():
                        page_num = idx + 1

                        # Copy files to session directory to preserve them before cleanup
                        session_viz_file = session_dir / f"page_{page_num}_visualization.json"
                        session_img_file = session_dir / f"page_{page_num}_original.png"

                        shutil.copy(viz_file, session_viz_file)
                        shutil.copy(orig_img, session_img_file)

                        visualization_data[page_num] = {
                            "viz_file": session_viz_file,
                            "img_file": session_img_file
                        }

        # Combine all pages
        combined_markdown = "\n\n---\n\n".join(all_markdown)
        combined_corrected_markdown = "\n\n---\n\n".join(all_corrected_markdown) if all_corrected_markdown else None

        processing_time = time.time() - start_time

        return {
            "success": True,
            "markdown": combined_markdown,
            "corrected_markdown": combined_corrected_markdown,
            "page_count": len(image_paths),
            "processing_time": round(processing_time, 2),
            "session_id": session_id,
            "visualization_data": visualization_data,
            "error": None
        }

    except Exception as e:
        processing_time = time.time() - start_time
        return {
            "success": False,
            "markdown": "",
            "page_count": 0,
            "processing_time": round(processing_time, 2),
            "session_id": session_id,
            "visualization_data": {},
            "error": str(e)
        }
    finally:
        # Cleanup: remove Output directory after processing
        try:
            output_base_dir = Path(__file__).parent.parent / "Output"
            if output_base_dir.exists():
                shutil.rmtree(output_base_dir)
                print(f"[API] Cleaned up Output directory")
        except Exception as e:
            print(f"[API] Cleanup warning for Output: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "OCR Pipeline API is running"
    }

@app.post("/api/test-simple")
async def test_simple():
    """Simple test endpoint with no dependencies"""
    print("[TEST] Simple endpoint called")
    return {"message": "Simple endpoint works"}

@app.post("/api/test-pydantic")
async def test_pydantic(data: UserRegister):
    """Test endpoint with Pydantic validation"""
    print(f"[TEST] Pydantic endpoint called with email: {data.email}")
    return {"message": f"Received email: {data.email}"}

# ═══════════════════════════════════════════════════════════════════════════
# AUTHENTICATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user account.

    Args:
        user_data: Email and password
        db: Database session

    Returns:
        JWT access token

    Raises:
        HTTPException: If email already exists
    """
    try:
        print(f"[AUTH] Registration attempt: {user_data.email}")

        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        # Create new user
        print(f"[AUTH] Hashing password...")
        hashed_pw = hash_password(user_data.password)

        print(f"[AUTH] Creating user record...")
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_pw
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Generate token
        print(f"[AUTH] Generating token...")
        access_token = create_access_token(data={"sub": str(new_user.id)})

        print(f"[AUTH] New user registered: {user_data.email} (ID: {new_user.id})")

        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH ERROR] Registration failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(e)}"
        )


@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Login with email and password.

    Args:
        user_data: Email and password
        db: Database session

    Returns:
        JWT access token

    Raises:
        HTTPException: If credentials are invalid
    """
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    # Generate token
    access_token = create_access_token(data={"sub": str(user.id)})

    print(f"[AUTH] User logged in: {user_data.email} (ID: {user.id})")

    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Args:
        current_user: Current user from JWT token

    Returns:
        User information
    """
    return current_user


@app.put("/api/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user password.

    Args:
        request: Current and new password
        current_user: Authenticated user
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If current password is incorrect
    """
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update password
    current_user.hashed_password = hash_password(request.new_password)
    db.commit()

    print(f"[AUTH] Password changed for user: {current_user.email}")

    return {"message": "Password changed successfully"}


@app.put("/api/auth/change-email")
async def change_email(
    request: ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user email.

    Args:
        request: New email and password for verification
        current_user: Authenticated user
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If password is incorrect or email already exists
    """
    # Verify password
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.new_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Update email
    old_email = current_user.email
    current_user.email = request.new_email
    db.commit()

    print(f"[AUTH] Email changed from {old_email} to {request.new_email}")

    return {"message": "Email changed successfully"}

@app.post("/api/upload", response_model=ProcessingResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload PDF and process through OCR pipeline (requires authentication).

    Args:
        file: PDF file upload
        current_user: Authenticated user
        db: Database session

    Returns:
        Processing results with markdown content and document ID
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Only PDF files are allowed."
        )

    # Create session directory for temporary processing
    session_id = str(uuid.uuid4())
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded file
    pdf_path = session_dir / file.filename

    try:
        # Read and validate file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB"
            )

        # Write file to disk
        with open(pdf_path, "wb") as f:
            f.write(contents)

        print(f"[API] Received file: {file.filename} ({len(contents)} bytes) from user {current_user.id}")

        # Process through pipeline
        result = process_pdf_pipeline(str(pdf_path), session_id)

        # If processing succeeded, save to persistent storage
        if result["success"]:
            # Create document storage directory with UUID
            storage_id = str(uuid.uuid4())
            user_storage = STORAGE_DIR / str(current_user.id)
            doc_storage = user_storage / storage_id
            doc_storage.mkdir(parents=True, exist_ok=True)

            # Copy PDF to storage
            storage_pdf_path = doc_storage / "original.pdf"
            shutil.copy(pdf_path, storage_pdf_path)

            # Save markdown to storage
            storage_md_path = doc_storage / "output.md"
            with open(storage_md_path, "w", encoding="utf-8") as f:
                f.write(result["markdown"])

            # Save corrected markdown to storage if available
            corrected_markdown = result.get("corrected_markdown")
            if corrected_markdown:
                storage_corrected_md_path = doc_storage / "output_corrected.md"
                with open(storage_corrected_md_path, "w", encoding="utf-8") as f:
                    f.write(corrected_markdown)
                print(f"[API] Saved corrected markdown to storage")

            # Save visualization data per page
            if "visualization_data" in result and result["visualization_data"]:
                for page_num, viz_data in result["visualization_data"].items():
                    # Copy visualization JSON
                    viz_src = viz_data["viz_file"]
                    viz_dst = doc_storage / f"page_{page_num}_visualization.json"
                    shutil.copy(viz_src, viz_dst)

                    # Copy original image
                    img_src = viz_data["img_file"]
                    img_dst = doc_storage / f"page_{page_num}_original.png"
                    shutil.copy(img_src, img_dst)

                print(f"[API] Saved visualization data for {len(result['visualization_data'])} pages")

            # Create database record
            document = Document(
                user_id=current_user.id,
                storage_id=storage_id,
                filename=file.filename,
                markdown_content=result["markdown"],
                corrected_markdown_content=corrected_markdown,
                page_count=result["page_count"],
                processing_time=result["processing_time"],
                file_size=len(contents)
            )

            db.add(document)
            db.commit()
            db.refresh(document)

            result["document_id"] = document.id
            print(f"[API] Document saved: ID={document.id}, StorageID={storage_id}, User={current_user.id}")

        return result

    except HTTPException:
        # Re-raise HTTP exceptions
        raise

    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )

    finally:
        # Cleanup: remove temporary session directory after processing
        try:
            if session_dir.exists():
                shutil.rmtree(session_dir)
                print(f"[API] Cleaned up session: {session_id}")
        except Exception as e:
            print(f"[API] Cleanup warning: {str(e)}")

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT LIBRARY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/documents", response_model=DocumentListResponse)
async def list_documents(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all documents for the current user with optional search.

    Args:
        search: Optional search query (searches filename and content)
        current_user: Authenticated user
        db: Database session

    Returns:
        List of documents with metadata
    """
    query = db.query(Document).filter(Document.user_id == current_user.id)

    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Document.filename.like(search_pattern)) |
            (Document.markdown_content.like(search_pattern))
        )

    # Order by most recent first
    documents = query.order_by(Document.created_at.desc()).all()

    # Add markdown preview (first 150 chars)
    doc_responses = []
    for doc in documents:
        doc_dict = {
            "id": doc.id,
            "user_id": doc.user_id,
            "filename": doc.filename,
            "page_count": doc.page_count,
            "processing_time": doc.processing_time,
            "file_size": doc.file_size,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "markdown_preview": doc.markdown_content[:150] + "..." if len(doc.markdown_content) > 150 else doc.markdown_content
        }
        doc_responses.append(DocumentResponse(**doc_dict))

    return {
        "documents": doc_responses,
        "total": len(doc_responses)
    }


@app.get("/api/documents/{doc_id}", response_model=DocumentDetailResponse)
async def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific document.

    Args:
        doc_id: Document ID
        current_user: Authenticated user
        db: Database session

    Returns:
        Document details with full markdown content

    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    return document


@app.get("/api/documents/{doc_id}/download/pdf")
async def download_pdf(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download the original PDF file.

    Args:
        doc_id: Document ID
        current_user: Authenticated user
        db: Database session

    Returns:
        PDF file

    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Construct file path using storage_id
    pdf_path = STORAGE_DIR / str(current_user.id) / document.storage_id / "original.pdf"

    if not pdf_path.exists():
        raise HTTPException(
            status_code=404,
            detail="PDF file not found on disk"
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=document.filename
    )


@app.get("/api/documents/{doc_id}/download/markdown")
async def download_markdown(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download the processed markdown file.

    Args:
        doc_id: Document ID
        current_user: Authenticated user
        db: Database session

    Returns:
        Markdown file

    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Construct file path using storage_id
    md_path = STORAGE_DIR / str(current_user.id) / document.storage_id / "output.md"

    if not md_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Markdown file not found on disk"
        )

    # Generate filename from original PDF name
    md_filename = Path(document.filename).stem + ".md"

    return FileResponse(
        path=md_path,
        media_type="text/markdown",
        filename=md_filename
    )


@app.get("/api/documents/{doc_id}/visualization")
async def get_visualization(
    doc_id: int,
    page: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get visualization data for a document page.

    Args:
        doc_id: Document ID
        page: Page number (1-indexed)
        current_user: Authenticated user
        db: Database session

    Returns:
        Visualization data with image and metadata

    Raises:
        HTTPException: If document not found or unauthorized
    """
    import base64

    print(f"[API] Visualization request: doc_id={doc_id}, page={page}, user={current_user.id}")

    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not document:
        print(f"[API] Document not found: doc_id={doc_id}")
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    print(f"[API] Document found: storage_id={document.storage_id}")

    # Construct file paths
    doc_dir = STORAGE_DIR / str(current_user.id) / document.storage_id
    viz_file = doc_dir / f"page_{page}_visualization.json"
    img_file = doc_dir / f"page_{page}_original.png"

    print(f"[API] Looking for viz_file: {viz_file}")
    print(f"[API] Looking for img_file: {img_file}")
    print(f"[API] viz_file exists: {viz_file.exists()}")
    print(f"[API] img_file exists: {img_file.exists()}")

    # Check if visualization data exists
    if not viz_file.exists():
        print(f"[API] Visualization file not found: {viz_file}")
        raise HTTPException(
            status_code=404,
            detail="Visualization data not found. This document may have been processed before the visualization feature was added."
        )

    if not img_file.exists():
        print(f"[API] Image file not found: {img_file}")
        raise HTTPException(
            status_code=404,
            detail="Original image not found"
        )

    # Load visualization metadata
    with open(viz_file, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    print(f"[API] Loaded metadata with {len(metadata.get('layout', []))} layout boxes")

    # Load and encode image as base64
    with open(img_file, "rb") as f:
        image_data = f.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")

    print(f"[API] Encoded image: {len(image_base64)} chars")

    return {
        "image_base64": image_base64,
        "metadata": metadata,
        "page_number": page,
        "total_pages": document.page_count
    }



@app.delete("/api/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a document and its files.

    Args:
        doc_id: Document ID
        current_user: Authenticated user
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Delete files from disk using storage_id
    doc_dir = STORAGE_DIR / str(current_user.id) / document.storage_id
    if doc_dir.exists():
        shutil.rmtree(doc_dir)
        print(f"[API] Deleted document files: {doc_dir}")

    # Delete database record
    db.delete(document)
    db.commit()

    print(f"[API] Deleted document: ID={doc_id}, User={current_user.id}")

    return {"message": "Document deleted successfully"}


@app.put("/api/documents/{doc_id}", response_model=DocumentDetailResponse)
async def update_document(
    doc_id: int,
    update_data: DocumentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update document markdown content.

    Args:
        doc_id: Document ID
        update_data: Updated markdown content
        current_user: Authenticated user
        db: Database session

    Returns:
        Updated document details

    Raises:
        HTTPException: If document not found or unauthorized
    """
    # Get document and verify ownership
    document = db.query(Document).filter(Document.id == doc_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this document")

    # Update database
    document.markdown_content = update_data.markdown_content
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)

    # Update filesystem
    md_path = STORAGE_DIR / str(current_user.id) / document.storage_id / "output.md"
    md_path.write_text(update_data.markdown_content, encoding='utf-8')

    print(f"[API] Updated document: ID={doc_id}, User={current_user.id}")

    # Return updated document
    return DocumentDetailResponse(
        id=document.id,
        user_id=document.user_id,
        filename=document.filename,
        markdown_content=document.markdown_content,
        page_count=document.page_count,
        processing_time=document.processing_time,
        file_size=document.file_size,
        created_at=document.created_at,
        updated_at=document.updated_at
    )


# ═══════════════════════════════════════════════════════════════════════════
# AUTOCORRECT ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/autocorrect", response_model=AutoCorrectResponse)
async def autocorrect_text(
    request: AutoCorrectRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Correct spelling in Vietnamese text.

    Args:
        request: Text to correct
        current_user: Authenticated user

    Returns:
        Original and corrected text with processing time

    Raises:
        HTTPException: If correction fails
    """
    start_time = time.time()

    try:
        # Get corrector singleton
        corrector = get_spelling_corrector()

        # Correct text
        corrected = corrector.predict(request.text)

        processing_time = time.time() - start_time

        print(f"[AutoCorrect] Corrected text for user {current_user.id} in {processing_time:.2f}s")

        return AutoCorrectResponse(
            original=request.text,
            corrected=corrected,
            processing_time=round(processing_time, 3)
        )

    except Exception as e:
        print(f"[AutoCorrect] Error: {str(e)}")
        import traceback
        traceback.print_exc()

        # Return original text if correction fails
        processing_time = time.time() - start_time
        return AutoCorrectResponse(
            original=request.text,
            corrected=request.text,  # Fallback to original
            processing_time=round(processing_time, 3)
        )


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    print("\n" + "="*70)
    print("  OCR Pipeline API Server")
    print("  Starting on http://localhost:8000")
    print("  API Docs: http://localhost:8000/docs")
    print("="*70 + "\n")

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
