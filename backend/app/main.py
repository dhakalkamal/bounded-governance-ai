from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import init_db
from backend.app.routers import documents, agents, findings, chat, audit


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Bounded Agentic Governance Platform",
    description="AI-powered governance analysis with bounded, auditable agents",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(agents.router)
app.include_router(findings.router)
app.include_router(chat.router)
app.include_router(audit.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "governance-api"}


# TODO: Google Drive OAuth connector endpoints
# TODO: Vector search pipeline integration
# TODO: BigQuery integration for analytics
# RBAC: Implemented via rbac.py with persona-based access control
