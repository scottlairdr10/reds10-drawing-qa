---
name: reds10-drawing-qa
description: >
  Run a structured, multi-phase Quality Assurance review on Reds10 drawings before issue or
  submission. Use this skill whenever Scott uploads drawings (as images or PDFs) or asks to
  check, validate, or review any drawing — including architectural, structural, MEP, module
  assembly, manufacturing, site layout, landscaping, acoustic, fire, or FFE drawings.
  Also trigger when Scott says things like "check these drawings", "are these ready to issue",
  "run QA on this drawing set", "review this against ISO 19650", or "is this title block right".
  Supports single or batch drawing review in one session. Auto-detects applicable phases based
  on drawing type. Pauses between phases for Scott's confirmation. Produces a RAG-rated report
  per drawing with a batch summary and exportable findings. Always use this skill for any
  drawing review — never do a shallow inline check when this skill is available.
---

# Reds10 Drawing QA Skill

A structured, phased Quality Assurance review for Reds10 drawings. Supports batch review of
multiple drawings in a single session. Produces RAG-scored findings per drawing, a batch
summary, and an exportable report.

---

## Drawing types supported

| Type | Code |
|------|------|
| Architectural (plans, elevations, sections) | ARCH |
| Structural | STRUC |
| MEP / services | MEP |
| Module assembly & manufacturing | MFG |
| Site layout & masterplan | SITE |
| Landscaping | LAND |
| Acoustic | ACOU |
| Fire | FIRE |
| FF&E (furniture, fixtures & equipment) | FFE |

---

## How to run a Drawing QA session

### Step 1 — Ingest drawings

When the user provides drawings (uploaded images, PDFs, or described content), for each drawing:

- Identify the **drawing type** from the table above
- Read the **title block** — extract: drawing number, title, revision, date, scale, author, checker, approver, project name, client
- Note the **ISO 19650 filename** if visible or provided
- Note the **discipline and scale**

State your inventory clearly before proposing the QA plan. Example:

> "I can see 3 drawings in this batch:
> 1. **R10-PRJ-001-ARCH-DR-001 Rev B** — Ground Floor Plan, 1:50
> 2. **R10-PRJ-001-STRUC-DR-010 Rev A** — Foundation Layout, 1:100
> 3. **R10-PRJ-001-MEP-DR-005 Rev A** — Ventilation Strategy, 1:50
>
> I'll run QA on all three. Here's the proposed phase plan — confirm or adjust before I start."

---

### Step 2 — Propose phase plan and confirm

Present the proposed phases for the batch. Allow the user to mark any phase as N/A before starting.

| Phase | Name | Default when |
|-------|------|-------------|
| 1 | Title Block Completeness | Always |
| 2 | ISO 19650 File Naming & Metadata | Always |
| 3 | Dimensional Accuracy & Coordination | ARCH, STRUC, MFG, SITE |
| 4 | Regulatory Compliance (NDSS, Building Regs, BS) | ARCH, STRUC, FIRE, ACOU |
| 5 | Employer Requirements Alignment | Any client-facing drawing set |
| 6 | Reds10 Internal Standards & Conventions | Always |
| 7 | Clash & Coordination Checks | Multi-discipline batches |
| 8 | Risks, Gaps & Missing Information | Always |

Present as a table with ✅ Run or ⚪ N/A per phase. Wait for "go" or adjustments before proceeding.

Phases marked N/A are excluded from the verdict and noted with a reason in the final summary.

---

### Step 3 — Run phases one at a time

Run each confirmed phase across **all drawings in the batch**, then stop and wait for the user
to say "continue", "next", or similar before moving to the next phase.

State clearly at the start of each phase:

> "**Starting Phase [N] — [Name]** — reviewing [n] drawings"

After each phase, ask:

> "Ready to move to Phase [N] — [Name]? Or would you like to discuss any findings first?"

---

## Phase instructions

### Phase 1 — Title Block Completeness

For each drawing, check:
- Drawing number present and correctly formatted
- Drawing title present and descriptive
- Revision letter/number present
- Revision date present
- Scale stated (and matches drawing if measurable)
- Prepared by / author named
- Checked by named
- Approved by named
- Project name present
- Client name present
- North point present (where applicable — plans)
- Sheet size stated or evident

---

### Phase 2 — ISO 19650 File Naming & Metadata

Check the filename (if provided) against the ISO 19650 naming convention:

**Standard field order:**
`[Project]-[Originator]-[Volume/System]-[Level/Location]-[Type]-[Role]-[Number]`

Common field codes to verify:
- Originator code matches Reds10's registered code
- Type code correct for drawing type (DR = drawing)
- Discipline/role code correct (A = Architectural, S = Structural, M = Mechanical, E = Electrical, etc.)
- Number is sequential and zero-padded (e.g. 0001 not 1)
- Revision follows convention (P01, P02... for preliminary; C01, C02... for contract; or A, B, C per project convention — check consistency)
- No spaces in filename
- No special characters other than hyphens

Also check:
- CDE status suitcase code present if applicable (WIP / SHARED / PUBLISHED / ARCHIVED)
- Revision in filename matches revision in title block

See `references/iso19650-naming.md` for full field reference.

---

### Phase 3 — Dimensional Accuracy & Coordination

Check (where drawings are legible/measurable):
- Overall dimensions stated and internally consistent
- Module dimensions within Reds10 transport constraints: max width **4.9m**, check height and length
- Grid lines referenced consistently across drawings in the batch
- Dimensions between drawings in the batch are coordinated (e.g. structural grid matches architectural grid)
- Section and elevation markers on plans correspond to actual section/elevation drawings in the batch
- Room areas stated where required; spot-check against dimensions shown
- Setting out dimensions present for site drawings
- Detail references call up drawings that exist in the set

---

### Phase 4 — Regulatory Compliance

Apply checks based on drawing type. Load `references/ndss-2015.md` for space standard checks.

#### NDSS 2015 — apply to ARCH plans
- GIA meets minimum for dwelling type and bed count
- Individual room sizes meet minima
- Built-in storage provision shown
- Ceiling heights ≥2.3m indicated

#### Building Regulations
- **Part A (Structure)**: structural drawings reference approved design standard
- **Part B (Fire)**: fire strategy drawings show compartmentation, escape routes, travel distances, fire door locations; sprinkler zones shown where required
- **Part M (Accessibility)**: M4(1)/M4(2)/M4(3) category stated; turning circles, door widths, level thresholds shown on ARCH drawings
- **Part F (Ventilation)**: MEP drawings show ventilation strategy with flow rates
- **Part L (Energy)**: thermal elements noted on relevant drawings

#### British Standards
- Any BS cited on drawings: verify current edition
- Fire drawings: check against BS 9999 / BS 9991 as applicable
- Acoustic drawings: check against BS 8233 / BB93 as applicable
- Structural drawings: check EC2/EC3/EC5 references as applicable

---

### Phase 5 — Employer Requirements Alignment

- Does the drawing set cover all deliverables listed in the ER drawing schedule?
- Are drawing scales as specified in the ER?
- Is the naming convention as specified in the ER (may override ISO 19650 defaults)?
- Are ER-specific notes, symbols, or legend requirements present?
- Flag any ER drawing obligations not evidenced in this batch

---

### Phase 6 — Reds10 Internal Standards & Conventions

- Reds10 title block template used (not a generic or client template unless ER-required)
- Logo present: correct variant for background (charcoal-primary on white/light)
- "Reds10" spelled correctly — never REDS10 or Reds 10
- Brand colours applied correctly where colour is used: Red #de134d, Charcoal #40404c, Chalk #e3ded2, Teal #69c0b0 (accent only)
- Module reference system consistent with Reds10 internal conventions
- Layer naming consistent (if CAD/BIM source is visible)
- Drawing status codes consistent with Reds10 issue sheet conventions
- Notes style consistent — no informal language, no TBCs or [INSERT] markers

---

### Phase 7 — Clash & Coordination Checks

For multi-discipline batches:
- Structural grid consistent across ARCH and STRUC drawings
- MEP routes do not visually conflict with structural elements shown
- Door and window positions consistent between architectural plan and elevation
- Module interfaces consistent between MFG and ARCH drawings
- Fire compartment boundaries on FIRE drawings consistent with ARCH plans
- FFE layout consistent with room dimensions on ARCH plans
- Acoustic zones consistent with room layout on ARCH plans
- Site drawings consistent with building footprint on ARCH drawings

Note: This phase is based on visual/drawn coordination only. It does not replace a formal BIM clash detection process.

---

### Phase 8 — Risks, Gaps & Missing Information

- What is shown but not dimensioned?
- What is referenced but not included in the batch?
- What notes are ambiguous or incomplete?
- Are there any contradictions between drawings in the batch?
- What would a building control officer, planning officer, or contractor query?
- Are any drawings marked as superseded but still included in the batch?
- Is the revision status of all drawings in the batch consistent (i.e. no mixed preliminary/contract revisions without explanation)?
- Are there any drawings missing that would normally be expected for this stage?

---

## RAG rating system

| RAG | Meaning |
|-----|---------|
| 🔴 RED | Critical — must be resolved before issue. Compliance failure, missing required content, naming error, or coordination conflict. |
| 🟡 AMBER | Should be resolved — affects quality, completeness, or confidence. Not a showstopper but a risk. |
| 🟢 GREEN | No issues found. |
| ⚪ N/A | Phase not applicable to this drawing or batch — noted with reason. |

---

## Per-drawing output format

After each phase, output findings per drawing:

---
**Phase [N] — [Name]**

**Drawing: [ref] — [title]** — 🔴 RED / 🟡 AMBER / 🟢 GREEN

| # | Finding | RAG | Action required |
|---|---------|-----|-----------------|
| 1 | [Issue] | 🔴 | [Action] |

*(Repeat for each drawing in the batch)*

**Phase verdict:** [One sentence across the batch.]

---

## Batch summary format (after all phases)

---
## Drawing QA Summary — [Project / Batch name]
**Date:** [today]
**Drawings reviewed:** [n] — [list refs]
**Phases run:** [list]
**Phases N/A:** [list with reasons]

| Drawing | Ph1 | Ph2 | Ph3 | Ph4 | Ph5 | Ph6 | Ph7 | Ph8 | Overall |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|---------|
| [ref] | 🟢 | 🔴 | 🟡 | ⚪ | ... | | | | 🔴 |

**Batch overall RAG:** 🔴 RED / 🟡 AMBER / 🟢 GREEN

**Issue recommendation:** [Clear verdict — e.g. "Do not issue — [n] drawings have critical findings." or "Ready to issue subject to Amber items at discretion."]

**Critical findings across batch:**
| # | Drawing | Phase | Finding | Action |
|---|---------|-------|---------|--------|
| 1 | [ref] | [phase] | [finding] | [action] |

---

## Exportable report note

At the end of the session, offer:

> "Would you like me to generate an exportable QA report as a Word document (.docx)? I can produce a formatted Reds10-branded report covering all findings from this session."

If yes, follow the `reds10-jd` skill to produce a branded .docx output.

---

## Tone and communication style

- Be specific — name the exact field, dimension, or reference that fails
- Do not soften critical findings — if it's RED, say so clearly
- Where a standard has a specific requirement, quote it
- If a drawing is not legible enough to check a specific item, flag it as AMBER with a note
- Keep language professional and purposeful — consistent with Reds10's expert tone
