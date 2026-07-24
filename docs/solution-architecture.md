# Solution Architecture

## 1. High-Level Architecture

```
                         ┌─────────────────────────────┐
                         │   Conversational Interface    │
                         │  (Web/Voice, EN + Kannada)    │
                         └───────────────┬───────────────┘
                                          │
                              Catalyst API Gateway
                                          │
        ┌─────────────────────────────────────────────────────────┐
        │                     Serverless Functions Layer            │
        │                                                           │
        │  fir-ingestion   entity-linking   chat-query               │
        │  risk-scoring    anomaly-detection   report-generator      │
        │  alerts (Signals)                                          │
        └───────────────┬─────────────────────────┬─────────────────┘
                         │                         │
              ┌──────────▼──────────┐   ┌──────────▼──────────┐
              │  Catalyst Data Store │   │   Catalyst NoSQL      │
              │  (structured graph   │   │  (unstructured case    │
              │   entities & edges)  │   │   attributes, raw text)│
              └──────────────────────┘   └────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Catalyst Stratus     │  (documents, images, evidence files)
              └───────────────────────┘

        Supporting: Zia Services (NLP/OCR/Speech), QuickML (LLM/RAG),
        Zia AutoML (risk scoring), SmartBrowz (PDF reports),
        Authentication, Signals + Event Functions, Cron, Mail, Cache
```

## 2. Core Data Model (Knowledge Graph)

**Nodes:**
- Offender (with aliases)
- Victim
- Witness
- FIR / Case
- Location (station, district, geo-coordinates)
- Vehicle
- Phone Number
- Financial Account / Transaction
- Modus Operandi (MO) Tag

**Edges (relationships):**
- Offender —involved_in→ FIR
- Offender —linked_to→ Offender (co-accused, associate)
- FIR —occurred_at→ Location
- FIR —tagged_with→ MO
- Offender —used→ Phone Number / Vehicle
- Offender/Victim —transacted_via→ Financial Account
- Witness —testified_in→ FIR
- Witness —proximity_to→ Offender Network (derived edge, used for tampering-risk scoring)

This graph structure is what allows one underlying data model to serve network analysis, pattern discovery, offender profiling, and witness-risk scoring — rather than requiring five separate systems.

## 3. Component Responsibilities

| Component | Responsibility |
|---|---|
| `fir-ingestion` function | Parses raw FIR text (English/Kannada), extracts entities via Zia Text Analytics, normalizes name/vehicle/phone variants |
| `entity-linking` function | Resolves extracted entities against existing graph nodes (fuzzy matching for aliases/spelling variants), creates/updates edges |
| `chat-query` function | Converts natural language / voice query into a graph query (via QuickML RAG over the Data Store), returns structured + narrative answer |
| `risk-scoring` function | Computes offender reoffense risk and witness tampering risk using Zia AutoML on graph-derived features |
| `anomaly-detection` function | Flags cases where an offender's MO diverges from their historical pattern (see `anomaly-detection-notes.md`) |
| `report-generator` function | Produces PDF case summaries and conversation history exports via SmartBrowz |
| `alerts` (Signals + Event Functions) | Triggers notifications on new cross-district linkages, bail-status changes, or emerging hotspot spikes |
| Frontend (Slate / Web Client Hosting) | Chat UI, network graph visualization, geospatial dashboard, role-based views |

## 4. Data Flow (End-to-End)

1. New FIR text (or historical bulk import) enters via `fir-ingestion`.
2. Entities are extracted and normalized.
3. `entity-linking` matches against existing graph; new nodes/edges created in Data Store; unstructured attributes stored in NoSQL; documents/evidence in Stratus.
4. `anomaly-detection` and `risk-scoring` run asynchronously (event-triggered via Signals) on graph updates.
5. Investigator issues a query via chat/voice → `chat-query` retrieves relevant subgraph → QuickML composes a natural-language, explainable answer with citations to source FIRs.
6. If a new high-risk linkage is found, `alerts` notifies the relevant supervisor/analyst via Push Notifications / Mail.
7. Investigator can export a PDF case summary or full conversation history via `report-generator`.

## 5. Explainability Layer (cross-cutting)
Every function that produces a graph edge, risk score, or anomaly flag writes a corresponding **evidence record**: source FIR ID(s), matched field(s), confidence score, timestamp, and model version. This is not a separate feature — it is a required output of every function in the pipeline (see `explainability-template.md`).

## 6. Security & Governance (cross-cutting)
Role-based access (Investigator / Analyst / Supervisor / Policymaker) is enforced at the API Gateway and Data Store level. All queries and AI outputs are logged for audit (see `roles-and-access.md`, `audit-and-verification-policy.md`).

## 7. Non-Functional Requirements
- Near real-time entity linking (target: under a few seconds per new FIR for extraction + linking).
- Multilingual support (English, Kannada) at both input (chat/voice) and extraction (FIR text) layers.
- Graceful degradation: if QuickML/LLM layer is unavailable, direct structured graph queries should still function via the Data Store.
- All AI outputs must degrade to "lead requiring verification," never "confirmed fact," per governance policy.
