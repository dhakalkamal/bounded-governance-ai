# Bounded Agentic Governance Platform — Architecture

## Overview
This system is an enterprise-grade, governance-first AI platform designed to analyze board minutes, governance documents, and related artifacts using **bounded agentic AI**. Every AI action is permission-aware, auditable, evidence-linked, and constrained by explicit authority rules.

The platform supports:
- Google Drive + Google Calendar connectors (read-only)
- Governance dashboards and reports
- Enterprise search, summarization, and governed chat
- Multiple specialized agents with strict access boundaries

---

## High-Level Architecture

[ Web App ]
    |
    v
[ Auth & RBAC ]
    |
    v
[ API Gateway ]
    |
    +-------------------+
    |                   |
[ Connector Service ]   [ Ingestion Service ]
    |                   |
    v                   v
[ Google Drive / Calendar ]   [ Cloud Storage (Raw Docs) ]
                                    |
                                    v
                          [ Processing Pipeline ]
                                    |
                                    v
                   +----------------+----------------+
                   |                                 |
          [ Structured Store ]              [ Vector Index ]
         (Firestore / BigQuery)        (Vertex Vector Search)
                   |                                 |
                   +---------------+-----------------+
                                   |
                            [ Agent Orchestrator ]
                                   |
                   +---------------+-----------------+
                   |               |                 |
        [ Minutes Agent ]  [ Framework Agent ]  [ COI Agent ]
                   |               |                 |
                   +---------------+-----------------+
                                   |
                           [ Findings Store ]
                                   |
                           [ Report Generator ]
                                   |
                          [ Reports (GCS) ]

---

## Core Components

### Frontend (Web App)
Pages:
- Governance Dashboard
- Board Meeting Minutes Analyzer
- Governance Framework Checker
- Conflict-of-Interest Dashboard
- Governance Reports Center
- Enterprise Search + Chat

All user actions are scoped to a **Project**, which acts as the primary permission boundary.

---

### Backend Services

#### 1. Auth & RBAC Service
- User authentication
- Role-based access control
- Project membership enforcement

Roles (example):
- Org Admin
- Governance Analyst
- Auditor (read-only)
- Viewer (limited read-only)

---

#### 2. Connector Service (Google OAuth)
- Google Drive (read-only, picker-based)
- Google Calendar (read-only)

Scopes:
- drive.readonly
- calendar.readonly

Responsibilities:
- User-initiated imports only
- Token storage (encrypted)
- No background crawling

---

#### 3. Ingestion Service
- Validates uploads/imports
- Stores raw files in Cloud Storage
- Creates processing jobs
- Captures document metadata and version fingerprints

---

#### 4. Processing Pipeline
Steps:
1. OCR / text extraction (Document AI)
2. Chunking with anchors (page, section, offsets)
3. Metadata enrichment
4. Embedding generation
5. Index update

Outputs:
- Raw text + structure
- Chunk records
- Embeddings with metadata filters

---

## Permission Model

### RBAC (App-Level)
- Every API call checks user role + project membership
- No cross-project access allowed

### Document ACL (Doc-Level)
- Documents belong to a Project
- Access granted via project membership + doc visibility

Rule: No agent, search, or chat operation can access documents outside the user’s allowed scope.

---

## Agent Access Matrix

| Agent | Can Read | Can Write | Restrictions |
|-----|---------|----------|--------------|
| Indexer Agent | All ingested docs | Chunks, embeddings | No governance conclusions |
| Minutes Analyzer Agent | Minutes + packet docs | Decisions, risks, actions | No external docs |
| Framework Checker Agent | Minutes + policies + framework refs | Gap analysis | No compliance verdicts |
| COI Detector Agent | Minutes + disclosures | COI signals | Non-accusatory language only |
| Search Agent | Indexed chunks (filtered) | Snippets | Retrieval only |
| Chat Agent | Retrieved snippets only | Answers | Cannot access raw docs |
| Report Generator Agent | Findings + templates | Reports | User-triggered only |

---

## Guardrails

- Evidence required for all claims
- Citations mandatory
- No legal or compliance certification language
- Full audit trail for every action

---

## Key Design Principle

Intelligence is bounded by governance.
