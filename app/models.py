"""
Pydantic models for request/response validation
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# ═══════════════════════════════════════════════════════════════════════════
# AUTHENTICATION MODELS
# ═══════════════════════════════════════════════════════════════════════════

class UserRegister(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")


class UserLogin(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User information response"""
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2 (was orm_mode in v1)


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT MODELS
# ═══════════════════════════════════════════════════════════════════════════

class DocumentResponse(BaseModel):
    """Document information response"""
    id: int
    user_id: int
    filename: str
    page_count: int
    processing_time: float
    file_size: int
    created_at: datetime
    updated_at: datetime
    markdown_preview: Optional[str] = None  # First 150 chars for preview

    class Config:
        from_attributes = True


class DocumentDetailResponse(BaseModel):
    """Detailed document response with full markdown"""
    id: int
    user_id: int
    filename: str
    markdown_content: str
    corrected_markdown_content: Optional[str] = None
    page_count: int
    processing_time: float
    file_size: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """List of documents response"""
    documents: List[DocumentResponse]
    total: int


class DocumentUpdateRequest(BaseModel):
    """Document update request"""
    markdown_content: str


class ChangePasswordRequest(BaseModel):
    """Change password request"""
    current_password: str
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters")


class ChangeEmailRequest(BaseModel):
    """Change email request"""
    new_email: EmailStr
    password: str  # Require password for verification


# ═══════════════════════════════════════════════════════════════════════════
# EXISTING MODELS (from original server.py)
# ═══════════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    message: str


class ProcessingResponse(BaseModel):
    """OCR processing response"""
    success: bool
    markdown: str
    corrected_markdown: Optional[str] = None
    page_count: int
    processing_time: float
    session_id: str
    document_id: Optional[int] = None  # Added for saved documents
    error: Optional[str] = None


class VisualizationResponse(BaseModel):
    """Visualization data response"""
    image_base64: str
    metadata: Dict[str, Any]
    page_number: int
    total_pages: int


# ═══════════════════════════════════════════════════════════════════════════
# AUTOCORRECT MODELS
# ═══════════════════════════════════════════════════════════════════════════

class AutoCorrectRequest(BaseModel):
    """AutoCorrect request"""
    text: str = Field(..., max_length=10000, description="Text to correct")


class AutoCorrectResponse(BaseModel):
    """AutoCorrect response"""
    original: str
    corrected: str
    processing_time: float

