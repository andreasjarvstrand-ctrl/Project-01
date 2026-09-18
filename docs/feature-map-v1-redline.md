# Redline — Procurement PM Feature Map (first pass)

> Reviews `feature-map-v1-draft.md`, section references (§) point there.
> Status: for discussion. Once the redline is agreed, fold the accepted
> changes into a v2 of the feature map and start data modeling.

## Overall verdict

The draft is sound, and §0 (scope boundary) is its strongest section — every
future scope argument should be settled by re-reading it. The redline has
three recurring themes:

1. **Internal consistency** — four concepts are defined twice in different
   ways (stages, categories, savings, contract management). Each is a fork in
   the data model, so they must be resolved *before* modeling, not during.
2. **Lifecycle modeling** — one lifecycle stage shouldn't exist as a project
   stage at all (A4 below). This is the single most consequential fix.
3. **The offline/governance boundary** — "offline-first" and
   "compliance-grade audit trail" quietly conflict as drafted. One rule
   reconciles them (D2 below).

All ten open questions get a recommended answer in section C.

---

## A. Cross-cutting inconsistencies (resolve before data modeling)

### A1. Two competing stage vocabularies

§4 defines a seven-stage lifecycle. §5.3's portfolio pipeline board defines a
*different* eight-stage sequence (Identify Need → RFI → RFQ/RFP → Evaluation
→ Negotiation → Award → Contracted). If these are two separate fields, every
project needs double bookkeeping and the two will drift apart — which kills
the pipeline board, and the pipeline board is the flagship feature (it is the
direct answer to the visibility pain point the research identified).

**Fix:** the pipeline board must be a *view over the same stage-gate data*,
never a parallel status field. Since stage names are customizable per
template (§4), each template stage needs a mapping to a fixed canonical
pipeline phase — data-model implication: `Stage.canonical_phase` enum behind
the custom display name. Board columns render canonical phases; projects
appear in the column of their current stage's canonical phase.

### A2. Category: container or attribute? (§3 vs §5.3)

§3 makes Category/Portfolio a *container* (folders projects live inside);
§5.3 makes it a *custom field* on the project. Pick one.

**Fix: attribute, not container.** Category becomes a workspace-level entity
that projects reference (one primary category, optional secondary tags).
Reasons: (a) real sourcing events cross categories (an ERP sourcing event
touches IT, Finance, and Operations) and single-parent folders can't express
that; (b) the draft's own portfolio views are cross-cutting filters anyway,
so the container buys nothing; (c) moving a project between folders breaks
links and reporting history, while re-tagging doesn't. A category landing
page (all projects, suppliers, savings for a category) gives users the
"folder feel" without the single-parent constraint.

### A3. Savings: simple fields or benefit bank? (§3 vs §5.3)

§3 says "simple tracked fields"; §5.3 escalates to the benefit-bank model
(cost reduction / cost avoidance / incentive value against a documented
baseline). The benefit bank is a finance-grade subsystem — baselines need
evidence, sign-off, and dispute handling. That's creep.

**Fix: the §3 version wins for v1.** Fields: estimated spend, savings target,
savings realized, savings type (enum: reduction / avoidance / incentive), and
a free-text baseline note. The savings roll-up dashboard (§5.8) works fine on
these. Revisit the benefit bank only if a customer's finance team demands it.

### A4. "Contract & Relationship Management" must not be a project stage (§4 vs §5.6)

As drafted, stage 6 keeps every sourcing project open for the life of the
contract — potentially years. Consequences: zombie projects that never
close, meaningless % complete, and broken cycle-time reporting (§5.8 measures
days-per-stage; a stage that lasts three years destroys the average). It
also duplicates §5.6, which already models contracts as their own record.

**Fix:** the project lifecycle ends: Initiate → Research → Sourcing Event →
Evaluation & Selection → Award & Onboarding → Close-out (six stages). At
award, the project spawns/links the Contract record (§5.6); ongoing
obligations and performance reviews are recurring tasks attached to the
*contract/supplier*, not to the project. A renewal later is a new project
(type: Contract Renewal) linked to the same contract record. Projects close;
relationships persist on the supplier and contract records — which is where
§5.4 already puts the linked history.

### A5. Gate sign-off authority: per-gate named approvers, not roles (§2 vs §6)

§2 classifies legal/finance stakeholders as Members (full edit within the
project) apparently so they can participate in sign-offs; §6 assigns sign-off
capability by role. Both are wrong for the actual need: legal usually needs
to *approve* without needing to *edit*, and "who may approve gate 3" is a
per-project governance fact, not a workspace role.

**Fix:** approvers are named per gate per project (set by the template,
overridable by Admin). Any user, regardless of role — including a Viewer —
can be a designated approver for a specific gate. Keep the self-approval
block. This solves the legal/finance problem (they stay Viewers with comment
rights, see Q2), and it matches what auditors actually ask: "who was
authorized to approve this gate on this project, and who did?"

### A6. Viewer export contradiction (§6 vs §5.8)

§6 gives Viewers "view only" on reports, but §5.8's exportable PDF/Excel
steering packs are aimed at executives — who are Viewers by §2's own
definition. **Fix:** Viewers may export any dashboard/report they can view.

### A7. Citation fragments

Inline artifacts ("Sirion + 4", "Ucdavis", "Business in a Box"…) survived the
research paste. Move to a references footnote or drop; they've been marked as
*(source: …)* in the transcribed draft as a stopgap.

---

## B. Section-by-section notes

### §0 Scope — keep verbatim, add the build-order implication

The "general-purpose engine + procurement vocabulary as configuration" claim
should be made an explicit build principle: **everything in §5.3–§5.7 should
be expressible through §5.1–§5.2 primitives (templates, custom fields,
views, recurring tasks) unless it genuinely can't be.** Where it can't —
scorecards, contracts, suppliers — that's precisely the signal it needs
first-class modeling. This one sentence settles most future "should X be a
feature or a template?" debates.

### §1 Research — one correction (RFT)

RFT is not simply "the public-sector term for an RFP." A tender is typically
more rigid: responses are often *binding offers* evaluated strictly against
published criteria, with little or no negotiation permitted afterward. This
matters downstream: the §4 lifecycle must support a **no-negotiation path**
(tender: Evaluation → Award directly), which the customizable-template
mechanism covers — but the RFT template should ship that way by default.
RFS is a nonstandard, low-usage term: keep it in the enum, build nothing
specific for it.

### §2 Roles — three roles confirmed; redefine the stakeholder story

Three workspace roles is right. But per A5, internal stakeholders (legal,
finance, business unit) should default to **Viewer + comment rights + gate
approver where designated**, not Member. Member is for people who create and
edit work product. Also note explicitly: multiple Admins supported (bus
factor).

### §3 Taxonomy — apply A2/A3/A4, plus two missing entities

- Apply A2 (category as attribute), A3 (simple savings fields), A4 (contract
  is a record, not a stage).
- **Missing: the Contract record.** §5.6 defines it but §3's taxonomy never
  lists it. It's a first-class workspace entity linked to supplier +
  originating project.
- **Missing: where scorecards live.** Selection scorecards belong to a
  project (one sourcing event); performance scorecards belong to a supplier
  (a recurring series spanning projects). The taxonomy should say so — it
  changes the schema.
- "Risk Assessment" as a project *type* is borderline (risk assessment is
  usually an artifact within a project, and the RAID log already exists).
  Keep the template, but expect low usage; don't build anything specific.

### §4 Lifecycle — four changes

1. Apply A4: six stages, project ends at Close-out.
2. **Default lifecycles are per project type.** A Contract Renewal or
   Supplier Onboarding project never passes through "Sourcing Event." Each
   project type ships its own default stage set; the six-stage model is the
   Sourcing Event default. The draft says "customizable per Admin" but this
   needs to be a shipped default, not homework for every Admin.
3. **Define what a gate blocks: stage transition only.** Not retro-editing of
   prior-stage artifacts — the activity log covers that. Keeping gates narrow
   is what keeps this from becoming the BPM engine §4 rightly avoids.
4. **Gate rollback must exist.** Real projects go backward (failed
   negotiation → back to Evaluation). Without an explicit
   rollback-with-reason, teams will abandon projects and clone new ones,
   destroying the audit trail and the cycle-time data. Also: record stage
   entered/exited timestamps — §5.8's cycle-time reporting is built directly
   on them.

### §5.1 Workspace & structure

Add field types: URL and multi-select. Keep supplier-reference (it's what
makes the supplier directory useful). Drop "category/portfolio folders" per
A2.

### §5.2 Generic engine — the v1 pruning happens here

This list is one of everything Asana/ClickUp/monday have. Cuts and caps:

- **Gantt/timeline → v1.1.** List/board/calendar + milestones + dependencies
  cover procurement cadence; Gantt is the most expensive view to build well
  and the least-used for stage-gated work.
- **Dependencies: finish-to-start only in v1.** The "etc." (SS, FF, SF) is
  real cost for near-zero procurement usage.
- **"Configurable status workflows per phase" → one status set per project
  type.** Per-phase workflows multiply the configuration surface by the
  stage count (~6×) and make the portfolio board mapping (A1) much harder.
- Recurring tasks: keep, but see D5 (offline duplicate-spawn hazard).
- Everything else (subtasks, milestones, watchers, comments, attachments +
  versions, activity feed, search): confirmed v1 core.

### §5.3 Procurement fields and views

- Portfolio pipeline board: flagship — see A1 for how it must be built.
- Sourcing calendar: keep; it's nearly free once Calendar view exists (it's
  a saved filter over dated items).
- Kraljic field "suggesting governance rigor": for v1 this means the quadrant
  suggests a template (strategic → full-gate template; non-critical →
  lightweight template) — a suggestion at project creation, not an enforcement
  engine.

### §5.4 Supplier directory

- **Add: duplicate detection + merge.** Directories rot without it, and
  merge-with-history is much easier to design in from day one than to
  retrofit under foreign keys.
- Define status values (e.g., prospective / active / preferred /
  do-not-use) or make it an Admin-configurable list; the draft leaves
  "status" undefined.
- The "not a purchasing master record" fence: keep, verbatim, forever.

### §5.5 Scorecards — right feature, three unstated consequences

- **Permissions:** blind scoring needs a matrix row (§6): evaluators see only
  their own scores until reveal — including Admins by default (audit
  integrity; configurable if teams insist).
- **State machine:** scoring needs explicit round states (draft → submitted →
  revealed). "Optional blind scoring" is not a boolean on a field; it's a
  lifecycle on a scoring round. Flag for the data model.
- **Offline interplay:** score *entry* is safely local-first (private to the
  evaluator anyway), but *reveal* must be server-authoritative (see D2), and
  a round cannot reveal while a designated evaluator has submitted-but-unsynced
  scores — the UI must surface that pending state.
- Pass/fail gate criteria separate from weighted scoring: confirmed, good.

### §5.6 Contract & obligation tracking

Confirmed as scoped. One emphasis: **the renewal-notice reminder is the
single highest-value feature in this module** — a missed renewal-notice
window is the classic five-figure procurement failure. It stays in v1 no
matter what else gets cut. Obligations-as-recurring-tasks: keep — it's
nearly free given the recurring-task engine, and it's the pattern proof for
the §0 build principle.

### §5.7 Risk & governance

Confirmed. One addition for the immutable activity log: entries need **dual
timestamps** — occurred-at (client HLC, see D1) and recorded-at
(server-assigned sequence on accept). Offline edits arrive late; an audit
trail that silently reorders or backdates is worse than none. Display both.

### §5.8 Reporting

- Fixed, purpose-built dashboards in v1 (the four listed: status, portfolio,
  savings roll-up, cycle time). **Custom dashboard builder → v1.1** — it's a
  platform feature, and the draft already knows exactly which dashboards
  procurement needs.
- CSV/Excel export in v1; **PDF steering pack → v1.1** (layout-quality PDF is
  a project of its own).
- Supplier performance *trend charts* → v1.1 (the underlying recurring
  scorecards are v1, so the data accrues from day one).
- Cycle-time reporting depends on §4 change 4 (stage timestamps).

### §5.9 Collaboration

Confirmed. Slack/Teams webhooks are cheap — keep in v1. Guest access → Q1.

### §6 Permissions matrix — deltas only

Apply A5 (named gate approvers) and A6 (Viewer export). Plus:

- **Supplier directory Member scope (the inline open question): all Members
  edit all supplier records.** Owned-record ACLs add real complexity to
  protect against a non-problem at this team size; the directory is a shared
  asset, and edit-anxiety is better handled by history + undo than by locks.
- Member "delete = archive request only": simplify to *Members can archive
  projects they own; hard delete is Admin-only* (and server-authoritative,
  see D2). An archive-request queue is workflow machinery v1 doesn't need.
- New row — blind scoring: Evaluator sees own scores only until reveal
  (regardless of role); reveal is an explicit privileged action.

---

## C. Open questions — recommended positions

**Q1 (external supplier access): internal-only for v1 — but model
`SupplierContact` as its own entity now.** External access flips the security
model (auth, tenant isolation, data segregation between competing bidders)
and drags in the RFx-transaction scope §0 excludes. RFP responses arrive by
email/portal as they do today and get *logged* ("submission received" +
attachment). Having SupplierContact as an entity from day one means a portal
can attach later without a schema break.

**Q2 (Viewer comments): yes, Viewers can comment — default on, workspace
toggle off** for strict environments (external auditors). This is what fixes
the "executives ask questions by email" failure the research cites, and
combined with A5 it makes Viewer the correct home for legal/finance.

**Q3 (Member project creation): Members can create projects, with template
and category required at creation; workspace toggle to restrict to Admin.**
Governance lives at the gates, not at creation friction — an ungoverned
project that exists in the tool beats a governed one that lives in a
spreadsheet because creating it was annoying. Public-sector workspaces flip
the toggle.

**Q4 (per-project role overrides): no role matrices per project in v1. One
exception: private projects.** A project is either workspace-visible or
invite-only. That covers the actual scenario (sensitive negotiation a given
Member shouldn't see) with a binary flag instead of a per-project ACL system.
Full per-project role remapping only if real usage demands it — same
instinct as the draft.

**Q5 (document richness): file attachments + versioning only. No
collaborative pages in v1.** This is a load-bearing decision: it is the
choice that keeps §7's "no CRDT library" position true. The moment in-app
collaborative rich text exists, Yjs/Automerge and their sync complexity come
with it. Meeting notes live in comments or attached files.

**Q6 (multi-workspace): single-workspace product, but put `workspace_id` on
every table from day one.** Costs nothing now; makes multi-workspace (the
consultancy / multi-client case) additive instead of a migration.

**Q7 (concurrency profile): low — LWW-per-field + conflict banner is
proportionate.** Procurement teams are small (roughly 2–15) and work is
mostly partitioned by project and role; same-record, same-field concurrent
offline edits will be rare. The only place needing more than LWW is ordered
position, and fractional indexing is ~50 lines, not a library. Confirms the
draft's instinct.

**Q8 (multi-currency): yes, minimally.** Every money field is
(amount, ISO 4217 currency code). No FX engine in v1: roll-ups group by
currency, with optional Admin-entered conversion rates for the savings
dashboard. Retrofitting a currency code onto bare decimals after data exists
is genuinely painful; this is cheap insurance for a multi-market European
context.

**Q9 (recurring performance scorecards): recurring, via the existing
engine.** A performance review is a recurring task (attached to the
contract/supplier per A4) carrying a scorecard. No new machinery; ad hoc
reviews remain possible by just creating one.

**Q10 (audit retention): not answerable from here — needs the actual
regulatory driver named.** Non-blocking default: append-only, no deletion,
export supported; add retention *configuration* only when a rule demands
purging. Note the direction of risk: public-sector tender rules typically
mandate *keeping* records for years (commonly 3–10 depending on
jurisdiction), so the danger is premature deletion, not accumulation. Park
it; it doesn't block the data model.

---

## D. Offline/sync redline (§7)

The direction (local-first, per-field LWW, tombstones, delta sync, visible
sync state) is right. Eight tightenings:

**D1. Name the clock: Hybrid Logical Clocks.** "Logical timestamp rather than
wall-clock" should be HLC specifically — causal ordering for merges *plus* a
human-readable approximate time for the audit view (§5.7 dual timestamps).

**D2. Define the server-authoritative action class.** This is the most
important addition to the whole document. Not every action can be
local-first: **gate approvals, role/permission changes, blind-score reveal,
hard delete, and user management take effect only when the server accepts
them** — their entire value is non-repudiable ordering. Offline UX: the user
can *initiate* one (queued, clearly rendered as "pending — applies when
online"), but it is never shown as done. Everything else — tasks, fields,
RAID entries, comments, score entry — stays local-first. Without this split,
"offline-first" and "compliance-grade audit trail" are quietly incompatible;
with it, both hold.

**D3. Offline permission enforcement is UX, not security.** The cached-role
client-side check is a courtesy to the user. The server revalidates every
synced mutation against permissions *at accept time*; edits made offline
after a revocation are rejected and land in a visible "couldn't sync" tray
with the reason — never silently dropped. (This is the explicit rule the
draft flagged as missing.)

**D4. Tombstone GC: "until all clients confirm" is unbounded.** One laptop
in a drawer blocks garbage collection forever. Fix: tombstone TTL (60–90
days); a client offline longer than the TTL does a full resync instead of a
delta sync. Cap the delta-sync window at the same TTL.

**D5. Recurring-task materialization must be server-side or idempotent.**
Otherwise two offline clients both spawn "Q3 vendor review." Either the
server materializes occurrences, or occurrence creation is keyed by
(recurrence id, slot) so duplicates collapse on sync.

**D6. Attachments: content-addressed upload queue.** Deduplicates, makes
uploads resumable, and versioning (§5.2) falls out naturally. Define a
per-workspace storage quota early.

**D7. "Append-only never conflicts" is true only with stable IDs.** Comments
and log entries need client-generated stable IDs (UUIDv7) and HLC ordering,
or retries and multi-device authorship create duplicates and reorderings.

**D8. Blind scoring offline:** entry local-first, reveal server-authoritative
(per D2), reveal blocked while any designated evaluator has
submitted-but-unsynced scores — with that state surfaced, not mysterious.

**D9. The stack question this raises (decide at data-modeling time):** the
repo README says Next.js + Prisma + SQLite — that's the *server*. Local-first
in a web app needs a concrete client store (IndexedDB, or SQLite-in-browser
via wa-sqlite/OPFS) plus a sync protocol endpoint. The draft's design maps
cleanly onto a bespoke op-log + delta endpoint, which is consistent with the
Q7 decision to skip CRDT libraries. This is the first thing the data-model
phase should pin down, because the op-log shape constrains every table.

---

## E. Proposed v1 cut line

**v1 (must):** generic engine core (tasks/subtasks, FS dependencies,
list/board/calendar/table views, milestones, comments/@mentions, attachments
+ versions, activity log, global search) · stage-gates with named approvers,
rollback, and stage timestamps · project templates per type + custom fields ·
portfolio pipeline board + sourcing calendar · supplier directory with merge
· selection scorecards incl. blind rounds · RAID / RACI / stakeholder
register · contract records + renewal-notice reminders +
obligations-as-recurring-tasks · fixed dashboards + CSV/Excel export ·
notifications incl. Slack/Teams webhooks · offline per §7 as amended by
D1–D8.

**v1.1:** Gantt/timeline · custom dashboard builder · PDF steering packs ·
supplier performance trend charts · additional dependency types if demanded.

**Explicitly deferred (unchanged from §8, plus):** external supplier access
(Q1) · per-project role matrices beyond private projects (Q4) ·
collaborative documents (Q5) · benefit-bank savings model (A3) · SSO/SAML —
with one warning: if pharma and public sector are target customers, *their*
procurement teams will make SSO a purchasing blocker for this tool itself;
it should be first on the v2 list, not an afterthought.

---

## F. Entities the redlined map implies (preview for data modeling)

Not the model — just the nouns it will need, so the next phase starts from a
checklist:

Workspace · User · Membership (role) · Category · Supplier · SupplierContact
· Project (type, Kraljic quadrant, primary category, money fields per Q8) ·
ProjectTemplate · Stage (custom name + `canonical_phase`, entered/exited
timestamps) · Gate · GateApprover · GateApproval (incl. rollback events) ·
Task (recurrence-aware) · Milestone · RaidEntry · Stakeholder /
RaciAssignment · ScorecardTemplate · ScoringRound (state machine) · Score ·
Contract · ContractKeyDate (→ recurring tasks) · Document · DocumentVersion ·
Comment · CustomFieldDef · CustomFieldValue · SavedView · Notification ·
ActivityLogEntry (dual timestamps) — plus the sync layer: OpLog/ChangeSet ·
Tombstone.
