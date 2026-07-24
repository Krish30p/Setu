# Data Dictionary

## 1. Offender

| Field | Type | Source | Description |
|---|---|---|---|
| offender_id | string (UUID) | system-generated | Unique internal identifier |
| full_name | string | FIR / chargesheet | Primary recorded name |
| aliases | array[string] | NLP extraction | Known nicknames, spelling variants (e.g., Mohd/Md/Mohammad) |
| gender | enum | FIR | M / F / Other |
| age_at_first_offense | integer | FIR | Used in socio-demographic analysis |
| known_addresses | array[string] | FIR / chargesheet | Historical addresses, used for geospatial linkage |
| phone_numbers | array[string] | FIR / call records | Linked communication identifiers |
| vehicle_ids | array[string] | FIR | Linked vehicle registration numbers |
| associated_case_ids | array[string] | derived (entity-linking) | FIRs this offender is linked to |
| mo_tags | array[string] | derived | Modus Operandi tags observed across cases |
| risk_score | float (0-1) | derived (risk-scoring function) | Reoffense likelihood |
| risk_score_last_updated | datetime | system | Freshness indicator for risk score |
| bail_status | enum | case management | In custody / On bail / Absconding / Convicted |

## 2. Victim

| Field | Type | Source | Description |
|---|---|---|---|
| victim_id | string (UUID) | system-generated | Unique internal identifier |
| full_name | string | FIR | Recorded name |
| gender, age | enum, integer | FIR | For socio-demographic analysis |
| associated_case_ids | array[string] | derived | Linked FIRs |
| location_id | string | FIR | Location of incident |

## 3. Witness

| Field | Type | Source | Description |
|---|---|---|---|
| witness_id | string (UUID) | system-generated | Unique internal identifier |
| full_name | string | FIR / chargesheet | Recorded name |
| associated_case_ids | array[string] | derived | FIRs where this person is a witness |
| proximity_risk_score | float (0-1) | derived (risk-scoring function) | Tampering/intimidation risk based on graph proximity to offender network |
| contact_status | enum | case management | Reachable / Non-cooperative / Hostile / Unreachable |

## 4. FIR / Case

| Field | Type | Source | Description |
|---|---|---|---|
| fir_id | string | police records | Official FIR number |
| filing_date | date | FIR | Date filed |
| station_id | string | FIR | Filing police station |
| district_id | string | FIR | District |
| raw_text | text (Kannada/English) | FIR | Original unstructured narrative |
| crime_type | enum | FIR | Theft, chain-snatching, financial fraud, etc. |
| mo_tags | array[string] | derived (NLP) | Extracted Modus Operandi tags |
| status | enum | case management | Under investigation / Chargesheeted / Closed / Convicted |
| linked_offender_ids | array[string] | derived | Offenders linked to this FIR |
| linked_victim_ids, linked_witness_ids | array[string] | derived | Linked persons |

## 5. Location

| Field | Type | Source | Description |
|---|---|---|---|
| location_id | string | system | Unique identifier |
| station_name, district_name | string | master data | Administrative hierarchy |
| latitude, longitude | float | master data | For geospatial hotspot mapping |
| socio_economic_indicators | object | external/derived | Urbanization index, population density, etc. (see socio-demographic overlay) |

## 6. Vehicle

| Field | Type | Source | Description |
|---|---|---|---|
| vehicle_id | string | FIR | Registration number (may be partial in raw text) |
| vehicle_type | enum | FIR | Two-wheeler, car, etc. |
| linked_offender_ids | array[string] | derived | Offenders associated with this vehicle |

## 7. Phone Number

| Field | Type | Source | Description |
|---|---|---|---|
| phone_id | string | FIR / call records | Normalized phone number |
| linked_offender_ids | array[string] | derived | Offenders associated with this number |
| first_seen_case_id, last_seen_case_id | string | derived | Temporal tracking across cases |

## 8. Financial Account / Transaction

| Field | Type | Source | Description |
|---|---|---|---|
| account_id | string | financial crime records | Account or wallet identifier |
| linked_offender_ids, linked_victim_ids | array[string] | derived | Parties involved |
| transaction_id | string | financial records | Individual transaction reference |
| amount, date, transaction_type | float, date, enum | financial records | Transaction detail |

## 9. Modus Operandi (MO) Tag

| Field | Type | Source | Description |
|---|---|---|---|
| mo_id | string | taxonomy (see `mo_taxonomy.md`) | Standardized MO category |
| description | string | taxonomy | Human-readable definition |

## 10. Evidence / Explainability Record (cross-cutting)

| Field | Type | Source | Description |
|---|---|---|---|
| record_id | string | system | Unique identifier |
| source_type | enum | system | edge_creation / risk_score / anomaly_flag |
| source_fir_ids | array[string] | derived | FIRs that produced this output |
| matched_fields | array[string] | derived | Which fields drove the match (e.g., phone_number, mo_tag) |
| confidence_score | float (0-1) | derived | Model confidence |
| model_version | string | system | For traceability/reproducibility |
| verification_status | enum | investigator input | Unverified / Verified / Rejected |
