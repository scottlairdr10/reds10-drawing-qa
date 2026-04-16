# ISO 19650 File Naming Convention
## Reference for Reds10 Drawing QA Skill

---

## Standard field structure

Fields are separated by hyphens. No spaces permitted anywhere in the filename.

```
[Project]-[Originator]-[Volume/System]-[Level]-[Type]-[Role]-[Number]-[Revision].[ext]
```

Example:
```
R10-PRJ001-ZZ-00-DR-A-0001-C01.pdf
```

---

## Field definitions

| Field | Description | Example |
|-------|-------------|---------|
| Project | Project identifier (agreed per project) | R10-PRJ001 |
| Originator | Company/author code | R10 (Reds10) |
| Volume / System | Building volume, system, or zone | ZZ (whole project), B01 (building 1) |
| Level / Location | Storey or location | 00 (ground), 01 (first), ZZ (all levels) |
| Type | Document type code (see below) | DR |
| Role / Discipline | Discipline code (see below) | A |
| Number | Sequential zero-padded number | 0001 |
| Revision | Revision code (see below) | C01 |

---

## Type codes

| Code | Type |
|------|------|
| DR | Drawing |
| SP | Specification |
| CA | Calculation |
| MS | Method statement |
| RP | Report |
| SC | Schedule |
| MO | Model |
| CO | Correspondence |

---

## Discipline / Role codes

| Code | Discipline |
|------|-----------|
| A | Architecture |
| S | Structural |
| M | Mechanical (HVAC) |
| E | Electrical |
| P | Plumbing |
| F | Fire |
| L | Landscape |
| C | Civil |
| X | Multi-disciplinary |
| Z | General / unclassified |

---

## Revision codes

| Convention | Preliminary | Contract/Issued |
|-----------|-------------|-----------------|
| ISO 19650 preferred | P01, P02, P03... | C01, C02, C03... |
| Alpha (some projects) | A, B, C... | — |

- P = preliminary / work in progress
- C = contract issue / formally issued
- Never mix conventions within a project
- Revision in filename must match revision in title block

---

## CDE status codes (suitcase)

Some projects prefix filenames with a CDE status indicator:

| Code | Status |
|------|--------|
| WIP | Work in Progress — not for issue |
| S | Shared — issued for coordination/review |
| A | Authorised / Published — formally issued |
| X | Archived — superseded |

---

## Common errors to flag

- Spaces in filename → 🔴 RED
- Special characters other than hyphens (underscores, dots in fields) → 🟡 AMBER
- Revision in filename ≠ revision in title block → 🔴 RED
- Sequential number not zero-padded (e.g. "1" not "0001") → 🟡 AMBER
- Wrong type code for document (e.g. DR used for a spec) → 🟡 AMBER
- Wrong discipline code → 🟡 AMBER
- Preliminary revision (P-series) issued as contract document → 🔴 RED
- Missing revision field → 🔴 RED
- Originator code not matching Reds10's registered code → 🟡 AMBER

---

## Notes for QA use

- Project naming conventions may override ISO 19650 defaults — always check the ER or project BEP first
- Where a client has their own naming convention specified in the ER, that takes precedence
- Flag any deviation from the agreed convention even if it appears intentional — it should be documented
