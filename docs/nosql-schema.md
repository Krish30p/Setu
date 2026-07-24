# NoSQL Schema (Catalyst NoSQL)

## Purpose
Relational Data Store handles fixed-schema entities and relationships (see `er-diagram.md`, `data-dictionary.md`). Catalyst NoSQL handles data whose structure legitimately varies case to case — raw narrative text, variable case-type-specific attributes, and conversation history — without forcing schema migrations.

## Collection: `fir_raw_documents`
```json
{
  "fir_id": "FIR-2024-0117",
  "raw_text_english": "...",
  "raw_text_kannada": "...",
  "ocr_source": true,
  "extraction_metadata": {
    "extraction_model_version": "v1.2",
    "extraction_timestamp": "2024-06-01T10:32:00Z",
    "extracted_entities": [
      {"type": "phone_number", "value": "XXXXX4521", "confidence": 0.91, "span": [120, 133]},
      {"type": "vehicle", "value": "KA-04-XX-1234", "confidence": 0.85, "span": [200, 214]}
    ]
  }
}
```

## Collection: `case_type_attributes`
Because financial crime cases, property crime cases, and violent crime cases each carry different case-specific fields, this collection stores a flexible attribute bag keyed by case type.

```json
{
  "fir_id": "FIR-2024-0298",
  "crime_type": "financial_fraud",
  "attributes": {
    "transaction_ids": ["TXN-88213", "TXN-88214"],
    "bank_names": ["Bank A", "Bank B"],
    "suspected_amount": 450000
  }
}
```

```json
{
  "fir_id": "FIR-2024-0117",
  "crime_type": "chain_snatching",
  "attributes": {
    "item_description": "gold chain, approx 15g",
    "escape_vehicle_type": "two-wheeler",
    "time_of_day": "evening"
  }
}
```

## Collection: `conversation_history`
Stores chat/voice interaction logs for the "save conversation as PDF" requirement and for audit purposes.

```json
{
  "session_id": "SESSION-8891",
  "user_id": "INV-2201",
  "role": "investigator",
  "messages": [
    {"turn": 1, "speaker": "user", "text": "Show me cases linked to FIR-2024-0117", "language": "en", "timestamp": "..."},
    {"turn": 2, "speaker": "system", "text": "Found 2 linked cases via phone number match...", "evidence_refs": ["EVID-3312"], "timestamp": "..."}
  ],
  "exported_pdf_id": "PDF-6621"
}
```

## Collection: `anomaly_flags`
```json
{
  "flag_id": "ANOM-1123",
  "offender_id": "OFF-5521",
  "flag_type": "mo_shift",
  "description": "Shift from daytime chain-snatching to night-time house-breaking",
  "prior_mo_tags": ["chain_snatching", "daytime"],
  "current_mo_tags": ["house_breaking", "nighttime"],
  "confidence": 0.78,
  "detected_at": "2024-06-10T00:00:00Z",
  "verification_status": "unverified"
}
```

## Why NoSQL and Not Purely Relational
- FIR narrative text length, language, and OCR-vs-typed origin vary unpredictably.
- Case-type-specific attributes (financial vs. property vs. violent crime) would otherwise require dozens of mostly-null columns in a relational table, or frequent schema migrations as new crime types are onboarded.
- Conversation history is inherently nested/variable-length and does not benefit from relational normalization.
