"""
PostgreSQL Database Setup
Supports both local PostgreSQL and cloud providers (Supabase, Railway, Render, etc.)
"""

import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import contextmanager

# Database Configuration
DB_PROVIDER = os.getenv("DB_PROVIDER", "local")  # 'local', 'supabase', etc.
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "jobmailer")

# Build connection string
if DB_PASSWORD:
    DB_PASSWORD = quote_plus(DB_PASSWORD)
    DB_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    DB_URL = f"postgresql+psycopg2://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Alternative: Use DATABASE_URL directly (for Supabase, Railway, etc.)
if os.getenv("DATABASE_URL"):
    DB_URL = os.getenv("DATABASE_URL").replace("postgres://", "postgresql+psycopg2://")

# Create engine
engine = create_engine(
    DB_URL,
    echo=False,  # Set to True for SQL debugging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Test connections before using
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@contextmanager
def db_session():
    """Context manager for database sessions"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables initialized")


def get_db():
    """Dependency for FastAPI to inject database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
