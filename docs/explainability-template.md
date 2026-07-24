# Explainability Template

## Principle
Every AI-generated output in this platform — a graph link, a risk score, an anomaly flag, or a chat answer — must carry a structured evidence trail sufficient for an investigator to independently verify it. This is a design requirement, not a UI nicety: it is what makes the difference between a "lead" (usable) and an unaccountable black-box claim (unusable, and per `audit-and-verification-policy.md`, legally risky if relied upon uncritically).

## Standard Evidence Record Structure
Every function that produces an AI output writes a record of this shape (see also `data-dictionary.md` §10):

```json
{
  "record_id": "EVID-3312",
  "output_type": "entity_link | risk_score | anomaly_flag | chat_answer",
  "produced_by": "entity-linking function v1.3",
  "source_fir_ids": ["FIR-2024-0117", "FIR-2024-0298"],
  "matched_fields": [
    {"field": "phone_number", "value_pattern": "XXXXX4521", "confidence": 0.91}
  ],
  "reasoning_summary": "Both FIRs reference the same phone number, extracted with high confidence from surrounding text in each narrative.",
  "confidence_score": 0.91,
  "timestamp": "2024-06-01T10:32:00Z",
  "verification_status": "unverified",
  "verified_by": null,
  "verification_notes": null
}
```

## Application by Output Type

**Entity Link (offender/case/phone/vehicle connections)**
Must show: which two entities were linked, on what shared field, and the exact text span in each source FIR that produced the extraction.

**Risk Score (offender or witness)**
Must show: the top 3-5 contributing features and their individual weights/values, not just a final number. A score of "0.82" with no breakdown is not acceptable in this system's design.

**Anomaly Flag**
Must show: the offender's prior MO profile, the specific new case that triggered the flag, and what specifically changed (see `anomaly-detection-notes.md`).

**Chat Answer**
Must show: which underlying graph nodes/edges were retrieved to compose the answer (RAG-style citation), so a natural-language answer is always traceable back to specific FIR records — never generated from general model knowledge alone.

## UI Requirement
Every surfaced AI output in the interface must have a visible "Why?" / evidence icon that opens the corresponding evidence record. This should never be optional or hidden behind an advanced settings toggle — for a law-enforcement tool, explainability is baseline functionality, not a power-user feature.

## Verification Workflow
1. AI produces output → status `unverified`.
2. Investigator reviews evidence record → marks `verified` or `rejected`, with optional notes.
3. Only `verified` records should be cited in any formal case documentation or court-facing material — the system should visually distinguish unverified leads from verified ones at all times (e.g., different color/badge in the UI).
