"""
Database models and setup for OCR Pipeline
Uses SQLAlchemy ORM with SQLite backend
"""

from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Database file location
DB_PATH = Path(__file__).parent / "storage" / "ocr.db"
DB_PATH.parent.mkdir(exist_ok=True)

# SQLAlchemy setup
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

class User(Base):
    """User account model"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship to documents
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")


class Document(Base):
    """Processed document model"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    storage_id = Column(String, nullable=False, index=True)  # UUID for file storage directory
    filename = Column(String, nullable=False)
    markdown_content = Column(Text, nullable=False)  # Original OCR output
    corrected_markdown_content = Column(Text, nullable=True)  # Auto-corrected version
    page_count = Column(Integer, nullable=False)
    processing_time = Column(Float, nullable=False)
    file_size = Column(Integer, nullable=False)  # In bytes
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship to user
    owner = relationship("User", back_populates="documents")


# ═══════════════════════════════════════════════════════════════════════════
# DATABASE UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def init_db():
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)
    print(f"[DB] Database initialized at {DB_PATH}")


def get_db():
    """
    Database session dependency for FastAPI.

    Usage:
        @app.get("/endpoint")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
