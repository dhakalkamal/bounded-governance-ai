# Bounded Agentic Governance Platform

AI-powered governance analysis platform using coordinated Gemini agents to analyze board meeting minutes, detect governance gaps, and identify conflict-of-interest signals.

## Architecture

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Python FastAPI + SQLite
- **Agents**: Three specialized Gemini-powered agents with an orchestrator and self-correction loop
  - Minutes Analyzer — decisions, action items, risks, voting records
  - Framework Checker — governance gap analysis
  - COI Detector — conflict-of-interest signal detection

## Quick Start

```bash
cp .env.example .env
# Add your GEMINI_API_KEY to .env
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Development (without Docker)

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Key Differentiators

- **Bounded agents**: Every agent has explicit permission boundaries (access matrix enforced)
- **Self-correction loop**: A reviewer step re-examines findings and flags low-confidence items
- **Evidence-linked findings**: Every finding includes evidence quote, source, section reference, and confidence score
- **Full audit trail**: Every agent action is logged with timestamp, input hash, and output summary
