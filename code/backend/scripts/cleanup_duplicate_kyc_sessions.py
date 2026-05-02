"""
Script to cleanup duplicate active KYC sessions before applying unique constraint.

This script identifies users with multiple active KYC sessions (DRAFT or PENDING_INFO)
and keeps only the most recent one, marking older sessions as ABANDONED.

Run this BEFORE applying the unique constraint migration.
"""

import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.modules.kyc.models import KYCSession


async def cleanup_duplicate_sessions():
    """Find and cleanup duplicate active KYC sessions."""
    async with async_session_maker() as db:
        # Find users with multiple active sessions
        stmt = (
            select(KYCSession.user_id, func.count(KYCSession.id).label("count"))
            .where(KYCSession.status.in_(["DRAFT", "PENDING_INFO"]))
            .group_by(KYCSession.user_id)
            .having(func.count(KYCSession.id) > 1)
        )

        result = await db.execute(stmt)
        duplicate_users = result.all()

        print(f"Found {len(duplicate_users)} users with duplicate active sessions")

        for user_id, count in duplicate_users:
            print(f"\nUser {user_id} has {count} active sessions")

            # Get all active sessions for this user, ordered by started_at desc
            sessions_stmt = (
                select(KYCSession)
                .where(
                    KYCSession.user_id == user_id,
                    KYCSession.status.in_(["DRAFT", "PENDING_INFO"]),
                )
                .order_by(KYCSession.started_at.desc())
            )

            sessions_result = await db.execute(sessions_stmt)
            sessions = sessions_result.scalars().all()

            # Keep the most recent one, abandon the rest
            for i, session in enumerate(sessions):
                if i == 0:
                    print(
                        f"  ✓ Keeping session {session.id} (started: {session.started_at})"
                    )
                else:
                    print(
                        f"  ✗ Abandoning session {session.id} (started: {session.started_at})"
                    )
                    session.status = "ABANDONED"

        await db.commit()
        print(f"\n✅ Cleanup complete. {len(duplicate_users)} users processed.")


if __name__ == "__main__":
    asyncio.run(cleanup_duplicate_sessions())
