#!/usr/bin/env python3
"""
Migration script: SQLite → PostgreSQL
Exports data from SQLite and imports to PostgreSQL
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime
from database import SessionLocal
from models import Application, StreakEvent, Reply, Notification

# Path to SQLite database
SQLITE_DB = Path(__file__).parent / "jobmailer.db"


def migrate_applications():
    """Migrate applications from SQLite to PostgreSQL"""
    if not SQLITE_DB.exists():
        print(f"⚠️  SQLite database not found at {SQLITE_DB}")
        return 0

    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    try:
        cursor.execute("SELECT * FROM applications")
        apps = cursor.fetchall()
        
        if not apps:
            print("No applications to migrate")
            return 0

        db = SessionLocal()
        count = 0

        for app in apps:
            pg_app = Application(
                id=app["id"],
                hr_email=app["hr_email"],
                hr_name=app.get("hr_name", ""),
                company=app.get("company", ""),
                position=app["position"],
                status=app.get("status", "sent"),
                ats_score=app.get("ats_score", 0),
                sent_at=datetime.fromisoformat(app["sent_at"]) if app.get("sent_at") else datetime.utcnow(),
                reply_summary=app.get("reply_summary", ""),
                resume_filename=app.get("resume_filename", ""),
                cover_filename=app.get("cover_filename", ""),
                profile_url=app.get("profile_url", ""),
                profile_title=app.get("profile_title", ""),
                source=app.get("source", ""),
            )
            db.add(pg_app)
            count += 1

        db.commit()
        db.close()
        print(f"✓ Migrated {count} applications")
        return count

    except Exception as e:
        print(f"✗ Error migrating applications: {e}")
        return 0
    finally:
        sqlite_conn.close()


def migrate_streak_events():
    """Migrate streak events"""
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    try:
        cursor.execute("SELECT * FROM streak_events")
        events = cursor.fetchall()

        if not events:
            print("No streak events to migrate")
            return 0

        db = SessionLocal()
        count = 0

        for event in events:
            pg_event = StreakEvent(
                id=event["id"],
                event_date=datetime.fromisoformat(event["event_date"]) if event.get("event_date") else datetime.utcnow(),
                application_id=event.get("application_id"),
            )
            db.add(pg_event)
            count += 1

        db.commit()
        db.close()
        print(f"✓ Migrated {count} streak events")
        return count

    except Exception as e:
        print(f"⚠️  Error migrating streak events (may not exist): {e}")
        return 0
    finally:
        sqlite_conn.close()


def migrate_replies():
    """Migrate replies"""
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    try:
        cursor.execute("SELECT * FROM replies")
        replies = cursor.fetchall()

        if not replies:
            print("No replies to migrate")
            return 0

        db = SessionLocal()
        count = 0

        for reply in replies:
            pg_reply = Reply(
                id=reply["id"],
                application_id=reply.get("application_id"),
                hr_email=reply["hr_email"],
                from_email=reply.get("from_email", ""),
                subject=reply.get("subject", ""),
                body=reply.get("body", ""),
                summary=reply.get("summary", ""),
                thread_id=reply.get("thread_id", ""),
                received_at=datetime.fromisoformat(reply["received_at"]) if reply.get("received_at") else datetime.utcnow(),
            )
            db.add(pg_reply)
            count += 1

        db.commit()
        db.close()
        print(f"✓ Migrated {count} replies")
        return count

    except Exception as e:
        print(f"⚠️  Error migrating replies (may not exist): {e}")
        return 0
    finally:
        sqlite_conn.close()


def migrate_notifications():
    """Migrate notifications"""
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    try:
        cursor.execute("SELECT * FROM notifications")
        notifs = cursor.fetchall()

        if not notifs:
            print("No notifications to migrate")
            return 0

        db = SessionLocal()
        count = 0

        for notif in notifs:
            pg_notif = Notification(
                id=notif["id"],
                type=notif.get("type", "reply"),
                application_id=notif.get("application_id"),
                reply_id=notif.get("reply_id"),
                message=notif["message"],
                company=notif.get("company", ""),
                hr_name=notif.get("hr_name", ""),
                read=bool(notif.get("read", 0)),
            )
            db.add(pg_notif)
            count += 1

        db.commit()
        db.close()
        print(f"✓ Migrated {count} notifications")
        return count

    except Exception as e:
        print(f"⚠️  Error migrating notifications (may not exist): {e}")
        return 0
    finally:
        sqlite_conn.close()


def main():
    """Run all migrations"""
    print("\n🔄 Starting migration: SQLite → PostgreSQL\n")
    
    try:
        total = 0
        total += migrate_applications()
        total += migrate_streak_events()
        total += migrate_replies()
        total += migrate_notifications()
        
        print(f"\n✅ Migration complete! Total records: {total}\n")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}\n")
        exit(1)


if __name__ == "__main__":
    main()
