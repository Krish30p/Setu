# Data Privacy Notes

## Sensitivity Classification
Crime data is inherently sensitive personal data — offender, victim, and witness records especially so. This platform treats all person-linked records as high-sensitivity by default.

## Key Practices

1. **Data minimization at the policymaker/analyst tier**: Aggregate/statistical views (hotspot maps, socio-demographic trend charts) should be generated from anonymized or de-identified aggregates wherever the use case allows, per the role scoping in `roles-and-access.md`.

2. **Encryption at rest and in transit**: All data in Catalyst Data Store, NoSQL, and Stratus should be encrypted at rest; all API Gateway traffic over TLS.

3. **Field-level sensitivity tagging**: Fields such as phone numbers, financial account details, and victim/witness contact information should be tagged as restricted-access fields, visible only to roles with an operational need (Investigator/Analyst on active cases), not broadly queryable.

4. **Retention and purge policy**: Define retention periods aligned with applicable record-keeping regulations for police data; closed/archived cases beyond the retention window should be reviewed for purging or restricted archival access, distinct from active operational data.

5. **Audit logging as a privacy control, not just a security one**: Every access to a person-linked record is logged (who, when, why) — this both supports the verification policy (`audit-and-verification-policy.md`) and provides a mechanism to detect misuse of sensitive data (e.g., an investigator querying records outside their assigned cases).

6. **Witness protection sensitivity**: Witness risk scores and contact status (`risk-scoring-methodology.md`) are especially sensitive — access to witness-level tampering-risk data should be restricted to Investigator (own case) and Supervisor roles, not broadly visible to Analysts running unrelated queries.

7. **Consent and purpose limitation**: Data collected for investigative purposes should not be repurposed for unrelated analytics without appropriate governance sign-off — the socio-demographic/policy-level analytics should rely on aggregate statistical outputs, not raw person-level records, wherever possible.

## Note for Hackathon Scope
For the hackathon demo, this document should guide *design decisions* (e.g., role-based field masking, audit logging structure) even where full regulatory compliance implementation is out of scope for a prototype timeline — judges from a law-enforcement background will look for awareness of these constraints even in a demo, more than for a fully compliant production system.
