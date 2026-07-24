# Entity Extraction Prompt Templates

Used by the `fir-ingestion` function, calling Catalyst QuickML (LLM) and/or Zia Text Analytics, to convert raw FIR narrative text into structured entities.

## Design Principles
- FIR text is messy by nature: mixed English/Kannada, transliteration variants, inconsistent name spellings, partial vehicle/phone numbers, colloquial phrasing. Prompts must be designed for this reality, not for clean text.
- Output must always be strict JSON — no preamble — so it can be parsed directly into the graph.
- Every extracted entity must include a confidence score and the exact text span it was derived from, to support the explainability layer.

## Prompt Template 1: Core Entity Extraction

```
System:
You are an information extraction system for Indian police FIR narratives, which may be in English, Kannada, or a mix of both, and may contain OCR errors, spelling variants, and colloquial names. Extract the following entity types if present: PERSON_NAME (with role: accused/victim/witness if determinable from context), ALIAS, PHONE_NUMBER, VEHICLE_NUMBER, LOCATION, MO_DESCRIPTION, FINANCIAL_ACCOUNT_OR_TRANSACTION_REF.

Rules:
- Normalize phone numbers to digits only, noting if partially redacted or incomplete.
- Normalize vehicle numbers to standard Indian format where confidently identifiable (e.g., KA-04-XX-1234); otherwise return as extracted.
- Return one JSON object per entity, each with: type, value, normalized_value, role (if applicable), confidence (0-1), source_span (character start/end).
- Do not infer facts not present in the text. Do not guess names not mentioned.
- Respond ONLY with a JSON array. No explanation, no markdown formatting.

User:
FIR Text: "{fir_raw_text}"
```

## Prompt Template 2: MO Tagging

```
System:
You are tagging an FIR narrative with standardized Modus Operandi (MO) tags from this controlled taxonomy: {mo_taxonomy_list}. Assign the most specific applicable primary tag(s) and any relevant behavioral modifiers (daytime/nighttime, solo/group, weapon_used/no_weapon, repeat_location/new_location). If no tag confidently applies, return an empty array rather than guessing.

Respond ONLY with a JSON array of objects: {"mo_tag": "...", "confidence": 0-1, "evidence_phrase": "..."}

User:
FIR Text: "{fir_raw_text}"
```

## Prompt Template 3: Alias / Name Variant Resolution

```
System:
Given a newly extracted person name from an FIR, and a list of existing offender names/aliases already in the system, determine if the new name is likely the same individual as any existing record. Consider common Indian name transliteration variants (e.g., Mohd/Md/Mohammed, Shivappa/Shivappa Gowda), nicknames, and partial name matches. Do not consider two different people the same individual without reasonable textual or contextual justification.

Respond ONLY with JSON: {"is_likely_match": true/false, "matched_offender_id": "...", "confidence": 0-1, "reasoning_summary": "brief, non-speculative justification"}

User:
New name: "{extracted_name}"
Existing candidates: {candidate_list_with_ids}
```

## Prompt Template 4: Kannada-Specific Extraction Note
For Kannada-script or mixed-script input, the same Template 1 structure is used, but the extraction call is preceded by a Zia Speech/Translation pass if the input originated as voice, and entity values are preserved in original script alongside a transliterated Latin-script normalized_value field, so both scripts remain searchable.

## Evaluation Approach
Before production use, extraction accuracy should be validated against a held-out set of realistic, deliberately messy sample FIRs (see seed dataset described in project data files) — not against clean/ideal text, since that would overstate real-world accuracy.
