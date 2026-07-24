# SETU Platform - Pending Credentials and Configuration Registry

This document serves as the single source of truth for all API keys, model endpoints, and credentials required to run the Setu Platform on Zoho Catalyst. 

To run in **Production / Catalyst Cloud mode**, ensure these variables are configured in the Catalyst Console under **Serverless > Functions > Environmental Variables** or supplied via a local `.env` configuration.

---

## Environment & Configuration Flags

| Variable Name | Location | Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `USE_MOCK` | `backend/.env` | `true` | Swaps between local JSON mock layer and live Catalyst API calls. Resolved in `adapter.js` across functions. |
| `NODE_ENV` | `backend/.env` | `development` | Server runtime environment mode (`development`, `production`, `test`). |
| `PORT` | `backend/.env` | `5001` | Server listener port for the local API simulation gateway in `backend/server.cjs`. |
| `VITE_API_URL` | `frontend/.env` | `http://localhost:5001` | Base URL for frontend API requests to backend server. |

---

## Required Catalyst Service Credentials

| Variable Name | Service / Component | Used By (Function) | Description | Location in Code |
| :--- | :--- | :--- | :--- | :--- |
| `QUICKML_LLM_ENDPOINT` | QuickML GenAI / LLM | `fir-ingestion`, `entity-linking` | Key/ID of published QuickML LLM deployment for entity extraction and variant resolution. | `index.js` (quickml invocation block) |
| `QUICKML_RAG_ENDPOINT` | QuickML RAG Pipeline | `chat-query` | Endpoint ID for RAG search and natural-language query completions. | `index.js` (RAG execution block) |
| `AUTOML_MODEL_ID` | Zia AutoML | `risk-scoring` | Model ID of trained tabular reoffense classification model. | `index.js` (offender risk block) |
| `SMARTBROWZ_API_KEY` | Catalyst SmartBrowz | `report-generator` | API key for Zoho SmartBrowz PDF rendering. Returns mock stub in test mode. | `adapter.js` (SmartBrowz client class) |
| `REPORTS_FOLDER_ID` | Catalyst File Store | `report-generator` | Folder ID in Catalyst File Store where exported PDFs are stored. | `index.js` (file store upload block) |
| `ALERTS_FROM_EMAIL` | Catalyst Mail | `alerts` | Sender email domain (`alerts@setu.police.gov.in`) verified in Catalyst Console. | `index.js` (from_email field) |

---

## How to Bind Credentials

1. **Local Environment Testing**:
   Configure environment key-value pairs in `backend/.env` and `frontend/.env`.
2. **Catalyst Cloud Console Deployment**:
   Navigate to function settings in the Zoho Catalyst console and set environment variables under **Serverless > Functions > Environmental Variables**.
