# Bounded Agentic Governance Platform

AI-powered governance analysis platform using coordinated Gemini agents to analyze board meeting minutes, detect governance gaps, and identify conflict-of-interest signals — with explicit permission boundaries, evidence-linked findings, and a full audit trail.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌────────────────────────────────────┐
│  Next.js 14  │◄────►│  FastAPI API  │◄────►│         Agent Orchestrator          │
│  React + TS  │      │  async SQLite │      │                                    │
│  Tailwind    │      │  RBAC layer   │      │  Minutes ─► Framework ─► COI       │
│  shadcn/ui   │      │              │      │         ▼                          │
│  Recharts    │      │              │      │  Findings Reviewer (self-correct)  │
│              │      │              │      │  Cross-Document Analyzer           │
└─────────────┘      └──────────────┘      └────────────────────────────────────┘
   :3000                 :8000                   Gemini API
```

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Python FastAPI + async SQLite + Pydantic
- **Agents**: Three specialized Gemini-powered agents with an orchestrator and self-correction loop
  - **Minutes Analyzer** — decisions, action items, risks, voting records
  - **Framework Checker** — governance gap analysis against policies
  - **COI Detector** — conflict-of-interest signal detection (non-accusatory)
  - **Findings Reviewer** — self-correction step that re-examines and flags low-confidence findings
  - **Cross-Document Analyzer** — pattern detection across multiple meetings

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (for Docker setup)
- [Node.js 20+](https://nodejs.org/) and [Python 3.12+](https://www.python.org/) (for local development)
- A [Gemini API key](https://aistudio.google.com/apikey)

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/dhakalkamal/bounded-governance-ai.git
cd bounded-governance-ai

# 2. Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Build and start all services
docker-compose up --build
```

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000         |
| Backend  | http://localhost:8000         |
| API Docs | http://localhost:8000/docs    |

### Docker Details

The platform runs two containers orchestrated via `docker-compose.yml`:

| Service    | Base Image         | Exposed Port | Notes                                     |
|------------|--------------------|--------------|--------------------------------------------|
| `backend`  | `python:3.12-slim` | 8000         | FastAPI with health check at `/health`      |
| `frontend` | `node:20-alpine`   | 3000         | Multi-stage build, waits for backend health |

**Persistent volumes:**
- `uploads` — uploaded PDF/DOCX/TXT documents
- `db-data` — SQLite database

**Useful commands:**
```bash
# Start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove volumes (resets database and uploads)
docker-compose down -v

# Rebuild a single service
docker-compose up --build backend
```

## Development (without Docker)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable          | Required | Default                      | Description                     |
|-------------------|----------|------------------------------|---------------------------------|
| `GEMINI_API_KEY`  | Yes      | —                            | Google Gemini API key           |
| `API_KEY`         | No       | `dev-api-key-123`            | Backend API key for auth        |
| `DATABASE_URL`    | No       | `sqlite:///./governance.db`  | SQLite database path            |
| `FRONTEND_URL`    | No       | `http://localhost:3000`      | Frontend origin (for CORS)      |
| `BACKEND_URL`     | No       | `http://localhost:8000`      | Backend URL                     |

## Features

### Bounded Agents
Every agent has explicit permission boundaries enforced via an access matrix. The Minutes Analyzer can only read meeting minutes, the Framework Checker reads minutes + policies, and the COI Detector reads minutes + disclosures. No agent can access documents outside its defined scope.

### Self-Correction Loop
After all agents complete, a Findings Reviewer re-examines every finding — evaluating evidence quality, confidence calibration, clarity, and tone. Low-quality or suspicious findings are flagged for human review.

### Evidence-Linked Findings
Every finding includes a direct evidence quote, source document, section reference, confidence score (0–1), and severity level (high/medium/low/info). No unsourced claims are allowed.

### Cross-Document Analysis
The orchestrator performs pattern detection across multiple meetings, identifying recurring risks, unresolved action items, escalating themes, and persistent governance gaps.

### Role-Based Access Control (RBAC)
Five built-in personas with different permission levels:

| Role                | Permissions                                          |
|---------------------|------------------------------------------------------|
| Board Chair         | Full access (upload, analyze, chat, verify/dispute)   |
| Governance Analyst  | Upload, analyze, chat, view findings and audit        |
| Compliance Officer  | Chat, view findings, audit, and dashboard (read-only) |
| Ops Manager         | Chat, view findings, audit, and dashboard (read-only) |
| Intern              | View documents, audit, and dashboard only             |

Document-level ACLs restrict board minutes to authorized roles.

### Full Audit Trail
Every agent action is logged with timestamp, agent type, action, input hash, and output summary — queryable by job or agent type.

### Governed Chat
Ask questions grounded in uploaded documents and findings. Answers are constrained to cite evidence from the corpus — no hallucinated responses.

### Dashboard & Export
Visual charts (severity distribution, findings by agent, trends across meetings) with CSV export for findings data.

## API Endpoints

| Method | Endpoint                            | Description                     |
|--------|-------------------------------------|---------------------------------|
| POST   | `/api/documents`                    | Upload a document               |
| GET    | `/api/documents`                    | List accessible documents       |
| POST   | `/api/agents/analyze`               | Trigger agent analysis          |
| GET    | `/api/agents/status/{job_id}`       | Get analysis job status         |
| GET    | `/api/findings`                     | List findings (filterable)      |
| PATCH  | `/api/findings/{id}/status`         | Update finding status           |
| POST   | `/api/chat`                         | Governed chat                   |
| GET    | `/api/audit`                        | View audit trail                |
| GET    | `/health`                           | Health check                    |

## Project Structure

```
bounded-governance-ai/
├── agents/
│   ├── base.py              # Base agent class (Gemini, audit, access matrix)
│   ├── minutes_agent.py     # Minutes Analyzer agent
│   ├── framework_agent.py   # Framework Checker agent
│   ├── coi_agent.py         # COI Detector agent
│   └── orchestrator.py      # Orchestrator + Reviewer + Cross-Doc Analyzer
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app setup
│   │   ├── database.py      # SQLite schema and connection
│   │   ├── rbac.py          # Role-based access control
│   │   ├── auth.py          # API key verification
│   │   ├── config.py        # Environment settings
│   │   └── routers/         # API route handlers
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages (dashboard, documents, analysis, chat, audit)
│   │   ├── components/      # Shared UI components
│   │   ├── context/         # React Context (user state)
│   │   └── lib/             # API client, RBAC config, utilities
│   ├── Dockerfile
│   └── package.json
├── shared/
│   └── schemas.py           # Shared enums and access matrix
├── docker-compose.yml
├── .env.example
└── README.md
```

## Tech Stack

| Layer    | Technology                                                |
|----------|-----------------------------------------------------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts |
| Backend  | FastAPI, Pydantic, async SQLite (aiosqlite)               |
| AI       | Google Gemini (via google-genai SDK)                      |
| Infra    | Docker, Docker Compose                                    |

## License

This project is for academic and research purposes.
