# Similarity Scoring Logic

## Purpose
Determines how "similar" two FIRs/offenders are, powering the "show me cases like this one" query — the core of the network/link analysis capability.

## Feature Set
Similarity is computed as a weighted combination of the following features between two FIRs (or between an offender and a candidate case):

| Feature | Description | Suggested Weight |
|---|---|---|
| Shared entity match | Same phone number, vehicle number, or financial account appearing in both | 0.30 |
| Offender identity match (direct or alias-resolved) | Same offender_id, including resolved aliases | 0.25 |
| MO tag overlap | Jaccard similarity between MO tag sets of the two cases | 0.20 |
| Geospatial proximity | Same station/district, or within a defined radius | 0.10 |
| Temporal proximity | Time gap between incidents (closer = higher score, with decay) | 0.10 |
| Associate network overlap | Shared co-accused/associate nodes even without a direct offender match | 0.05 |

## Scoring Formula (illustrative)
```
similarity_score = 
    0.30 * shared_entity_score +
    0.25 * offender_identity_score +
    0.20 * mo_overlap_score +
    0.10 * geospatial_score +
    0.10 * temporal_score +
    0.05 * network_overlap_score
```
Each sub-score is normalized to [0, 1]. Weights should be tunable per query context (e.g., an analyst investigating a financial crime ring may want shared_entity_score weighted higher than MO overlap).

## Thresholding
- Score ≥ 0.75 → "Strong match" — surfaced prominently with full evidence trail.
- Score 0.5–0.75 → "Possible match" — surfaced but visually flagged as lower confidence.
- Score < 0.5 → not surfaced by default (available on request for exhaustive search).

## Why Not Pure Embedding Similarity Alone
A pure text-embedding similarity (e.g., comparing FIR narratives as vectors) would catch stylistic/topical similarity but miss the concrete, verifiable links (same phone number, same vehicle) that actually matter for investigation. This is why the scoring is feature-based and entity-grounded first, with narrative embedding similarity used only as a supplementary weak signal — not the primary driver — precisely so that every "match" can be explained in terms of a concrete shared fact (see `explainability-template.md`), not an opaque vector distance.

## Relationship to Anomaly Detection
This similarity logic answers "what looks the same." The anomaly detection logic (`anomaly-detection-notes.md`) answers the complementary question: "what looks like the same offender, but is behaving differently" — both are needed together; similarity alone would miss offenders deliberately varying their MO to evade detection.
