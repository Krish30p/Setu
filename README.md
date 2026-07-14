# Setu — Cross-Jurisdictional Criminal Intelligence Platform

Conversational AI + criminal network intelligence platform built for the Zoho Catalyst x Karnataka State Police Hackathon.

## What This Is
A platform that automatically links offenders, victims, witnesses, locations, vehicles, phone numbers, and financial trails extracted from FIR text into a single, cross-jurisdictional knowledge graph — queryable via natural language (English + Kannada, including voice) — with built-in pattern-break anomaly detection, witness-tampering risk scoring, and a fully explainable, verification-first governance model.

See `docs/solution-overview.md` for the full pitch and `docs/demo-script.md` for the live demo flow.

## Documentation Index

| Document | Purpose |
|---|---|
| `problem-statement.md` | The problem being solved, and why |
| `solution-overview.md` | One-page pitch summary |
| `solution-architecture.md` | System design, components, data flow |
| `catalyst-services-justification.md` | Why each Catalyst service was chosen |
| `data-dictionary.md` | Every entity/field in the system |
| `er-diagram.md` | Entity relationship structure |
| `nosql-schema.md` | Unstructured/flexible data schema |
| `mo_taxonomy.md` | Modus Operandi tag taxonomy |
| `entity-extraction-prompts.md` | NLP prompt templates for FIR parsing |
| `similarity-scoring-logic.md` | How "similar case" matching works |
| `anomaly-detection-notes.md` | Pattern-break / MO-shift detection (key differentiator) |
| `risk-scoring-methodology.md` | Offender and witness risk scoring |
| `explainability-template.md` | Evidence trail structure for every AI output |
| `roles-and-access.md` | Role-based access control |
| `audit-and-verification-policy.md` | "AI as lead, not evidence" governance policy (key differentiator) |
| `data-privacy-notes.md` | Sensitive data handling practices |
| `demo-script.md` | Live demo walkthrough |
| `team-details.md` | Team registration information |
| `deployment-notes.md` | Catalyst deployment proof/steps |

## Tech Stack
100% Zoho Catalyst, per hackathon requirement:
- Catalyst Serverless Functions (backend logic)
- Catalyst Data Store (relational graph entities)
- Catalyst NoSQL (unstructured/flexible case data)
- Catalyst Stratus (evidence document storage)
- Catalyst QuickML (conversational RAG interface)
- Catalyst Zia Services (NLP, OCR, Speech/Translation)
- Catalyst Zia AutoML (risk scoring models)
- Catalyst SmartBrowz (PDF report generation)
- Catalyst Authentication + API Gateway (auth, RBAC)
- Catalyst Signals + Event Functions (alerts)
- Catalyst Cron (scheduled recomputation)
- Catalyst Mail + Push Notifications
- Catalyst Slate / Web Client Hosting (frontend)
- Catalyst Pipelines (CI/CD)

Full justification for each: see `catalyst-services-justification.md`.

## Project Structure
```
/functions
  /fir-ingestion
  /entity-linking
  /chat-query
  /risk-scoring
  /anomaly-detection
  /report-generator
  /alerts
/frontend
  /components
  /pages
/docs        <- this documentation
/data        <- sample/seed datasets (realistic, deliberately messy)
/diagrams    <- visual ER diagram, architecture diagram
```

## Getting Started (fill in as implementation proceeds)
1. Set up Catalyst project (`catalyst init`), configure `catalyst.json`.
2. Provision Data Store schema per `er-diagram.md` / `data-dictionary.md`.
3. Provision NoSQL collections per `nosql-schema.md`.
4. Deploy Functions from `/functions`.
5. Load seed dataset from `/data`.
6. Deploy frontend via Slate/Web Client Hosting.
7. Configure Signals for alerting.
8. Run through `demo-script.md` end-to-end before presenting.

## Team
See `team-details.md`.
# Setu
