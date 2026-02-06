import aiosqlite
import os

DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///./governance.db").replace(
    "sqlite:///", ""
)


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    return db


async def init_db():
    db = await get_db()
    try:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                doc_type TEXT NOT NULL DEFAULT 'other',
                content_text TEXT,
                file_path TEXT,
                file_size INTEGER,
                uploaded_at TEXT NOT NULL,
                metadata_json TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'pending',
                document_ids TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                result_summary TEXT,
                error TEXT
            );

            CREATE TABLE IF NOT EXISTS findings (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                finding_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                evidence_quote TEXT,
                source_document TEXT,
                section_reference TEXT,
                confidence REAL NOT NULL DEFAULT 0.0,
                severity TEXT NOT NULL DEFAULT 'info',
                flagged_for_review INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                metadata_json TEXT DEFAULT '{}',
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                agent_type TEXT,
                action TEXT NOT NULL,
                job_id TEXT,
                document_id TEXT,
                input_hash TEXT,
                output_summary TEXT,
                details_json TEXT DEFAULT '{}'
            );
            """
        )
        await db.commit()
    finally:
        await db.close()
