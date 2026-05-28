"""
SQLAlchemy Models for PostgreSQL
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    hr_email = Column(String(255), nullable=False, index=True)
    hr_name = Column(String(255), default="")
    company = Column(String(255), default="")
    position = Column(String(255), nullable=False)
    status = Column(String(50), default="sent")
    ats_score = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reply_summary = Column(Text, default="")
    resume_filename = Column(String(255), default="")
    cover_filename = Column(String(255), default="")
    profile_url = Column(String(500), default="")
    profile_title = Column(String(255), default="")
    source = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    streak_events = relationship("StreakEvent", back_populates="application", cascade="all, delete-orphan")
    replies = relationship("Reply", back_populates="application", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="application", cascade="all, delete-orphan")


class StreakEvent(Base):
    __tablename__ = "streak_events"

    id = Column(Integer, primary_key=True, index=True)
    event_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    application = relationship("Application", back_populates="streak_events")


class Reply(Base):
    __tablename__ = "replies"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    hr_email = Column(String(255), nullable=False, index=True)
    from_email = Column(String(255), nullable=False)
    subject = Column(Text, default="")
    body = Column(Text, default="")
    summary = Column(Text, default="")
    thread_id = Column(String(255), default="")
    received_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    application = relationship("Application", back_populates="replies")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), default="reply")
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    reply_id = Column(Integer, ForeignKey("replies.id"), nullable=True)
    message = Column(Text, nullable=False)
    company = Column(String(255), default="")
    hr_name = Column(String(255), default="")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    application = relationship("Application", back_populates="notifications")
