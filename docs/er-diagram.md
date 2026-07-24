# Entity Relationship Diagram (Written Description)

> Note: This is the textual/relational companion to the visual ERD (`.drawio` / `.png`). Use this to derive the actual Data Store schema; use the visual file for the pitch deck.

## Entities and Cardinalities

**Offender ↔ FIR**: Many-to-Many
- One offender can be involved in multiple FIRs.
- One FIR can involve multiple offenders (co-accused).
- Join table: `offender_fir_link` (offender_id, fir_id, role: primary/co-accused)

**Victim ↔ FIR**: Many-to-One (typically) / Many-to-Many (rare multi-victim overlap cases)
- Join table: `victim_fir_link` (victim_id, fir_id)

**Witness ↔ FIR**: Many-to-Many
- Join table: `witness_fir_link` (witness_id, fir_id)

**Offender ↔ Offender**: Many-to-Many (self-referencing)
- Represents co-accused/associate relationships.
- Join table: `offender_network_link` (offender_id_a, offender_id_b, relationship_type: co-accused/associate/family, source_fir_id)

**Witness ↔ Offender (derived)**: Many-to-Many
- Not directly recorded — derived by graph traversal (witness → shared associate/location → offender network).
- Materialized as `witness_proximity_link` (witness_id, offender_id, hop_distance, risk_contribution)

**FIR ↔ Location**: Many-to-One
- Each FIR occurs at one primary location; a location can have many FIRs.

**FIR ↔ MO Tag**: Many-to-Many
- Join table: `fir_mo_link` (fir_id, mo_id)

**Offender ↔ Phone Number**: Many-to-Many
- An offender may use multiple numbers over time; a number may (rarely, and flagged as high-suspicion) be shared across offenders.
- Join table: `offender_phone_link` (offender_id, phone_id, first_seen_date, last_seen_date)

**Offender ↔ Vehicle**: Many-to-Many
- Join table: `offender_vehicle_link` (offender_id, vehicle_id, first_seen_date, last_seen_date)

**Offender/Victim ↔ Financial Account**: Many-to-Many
- Join table: `party_account_link` (party_id, party_type: offender/victim, account_id)

**Financial Account ↔ Transaction**: One-to-Many
- Each account has many transactions; each transaction references source and destination accounts.

## Diagram Structure (for the visual ERD)

```
Offender ──< offender_fir_link >── FIR ──< victim_fir_link >── Victim
   │                                 │
   │                                 ├──< fir_mo_link >── MO Tag
   │                                 │
   │                                 └──> Location
   │
   ├──< offender_phone_link >── Phone Number
   ├──< offender_vehicle_link >── Vehicle
   ├──< offender_network_link >── Offender (self-referencing)
   └──< party_account_link >── Financial Account ──< Transaction

Witness ──< witness_fir_link >── FIR
Witness ──< witness_proximity_link (derived) >── Offender
```

## Design Rationale
- All "link" tables are edges in the underlying knowledge graph — the relational schema is a direct implementation of the graph model described in `solution-architecture.md`.
- `witness_proximity_link` is intentionally a **derived/materialized** table (recomputed by the risk-scoring function), not a directly recorded relationship — this is what allows witness tampering-risk to be calculated without requiring manual data entry.
- Historical fields (`first_seen_date`, `last_seen_date`) on offender-phone and offender-vehicle links are what make MO-shift and anomaly detection possible over time.
