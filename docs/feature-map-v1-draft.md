# Procurement PM Tool — Feature Map & Process Taxonomy (v1 draft)

> Status: first pass, under review. Transcribed to markdown verbatim from the
> 2026-07-07 draft (the §6 permissions table has been reflowed into a markdown
> table; wording unchanged). The redline review lives in
> `feature-map-v1-redline.md`.

## 0. Scope boundary — what this is and isn't

This is a project management tool that speaks procurement's language. It is
not a purchasing system.

In scope: managing procurement work as projects — sourcing events, category
strategy reviews, supplier onboarding, contract renewals — using the
vocabulary, stage-gates, and artifacts procurement teams already think in
(RFI/RFQ/RFP, Kraljic categorization, supplier scorecards, RAID logs).

Explicitly out of scope: purchase order creation/approval, invoice matching,
three-way match, payment processing, punch-out catalogs, e-auction bidding
engines, e-signature, and contract drafting. If a procurement team needs
those, that's a P2P or CLM system's job — this tool tracks the project of
getting to a contract, not the transaction after it.

Practically, this means the tool borrows terminology and structure from
procurement (RFx types, sourcing stages, category quadrants, scorecards) but
implements them as project templates, custom fields, and views inside a
general-purpose task/project engine — closer to "Asana or monday.com with
procurement's vocabulary baked in" than "SAP Ariba."

## 1. Research basis (brief)

Pulled from three angles: (a) procurement methodology — the RFx lifecycle
runs through identifying business requirements, drafting and issuing the RFx,
evaluating responses, selecting the supplier, and negotiating the contract,
with RFI for information gathering, RFQ for well-defined competitive pricing,
RFP combining information-gathering with detailed pricing, RFT as the
public-sector-preferred term for the same thing as an RFP, and RFS inviting
open-ended solutions; category strategy commonly uses the Kraljic matrix,
which classifies purchases into strategic, leverage, bottleneck, and
non-critical quadrants based on supply risk and profit impact, each requiring
a different sourcing strategy. (b) Generic PM tooling — feature benchmarking
across Asana, ClickUp, monday.com, Smartsheet, and Wrike, plus
permission-model patterns from Asana, GitLab, OpenProject, and Jira.
(c) Procurement-specific pain points — the dominant complaint is visibility:
without a shared source of truth, progress hides in email threads and
spreadsheets nobody updates, and lack of automation forces teams to chase
signatures across platforms, and at a portfolio level, teams often make
"best-for-project" instead of "best-for-business" decisions because they lack
centralized, connected visibility into what other project teams are procuring
at the same time. *(source: Sirion + 4)*

## 2. Users and roles

- **Admin** — category manager / procurement lead. Owns workspace
  configuration, templates, users, and reporting.
- **Member** — sourcing specialist, buyer, or an invited internal stakeholder
  (legal, finance, the requesting business unit) actively contributing to a
  project.
- **Viewer** — executives, auditors, or business stakeholders who need status
  visibility without edit rights.

## 3. Core taxonomy (conceptual — not the data model yet)

Workspace
→ Category / Portfolio (e.g., IT Services, Facilities, Clinical Supplies,
Marketing)
→ Project (one procurement initiative, e.g. "Cloud Hosting Sourcing 2027")

- Project type: Sourcing Event (RFI/RFQ/RFP/RFT/RFS), Contract Renewal,
  Supplier Onboarding, Category Strategy Review, Vendor Performance Review,
  Risk Assessment
- Kraljic quadrant tag (drives suggested rigor/template)
- Phase / stage-gate structure
- Tasks, subtasks, dependencies, milestones
- RAID log
- Stakeholder / RACI register
- Linked supplier record(s)
- Documents (stored/versioned, not generated)
- Savings target vs. realized (simple tracked fields)

→ Supplier / Vendor Directory (workspace-level, shared across projects)
→ Template library (project templates by sourcing type & category, RAID
templates, scorecard templates, RACI templates)

## 4. Default project lifecycle (stage-gate model, customizable per Admin)

1. **Initiate** — business case, budget check, stakeholder ID, RACI setup
2. **Research** — RFI, Kraljic classification, market scan
3. **Sourcing Event** — RFQ/RFP/RFT/RFS issued, Q&A tracked, submissions
   logged
4. **Evaluation & Selection** — scorecard, shortlisting, negotiation, award
   decision
5. **Award & Onboarding** — supplier onboarding checklist, handoff to contract
6. **Contract & Relationship Management** — key dates, obligations,
   performance reviews
7. **Close-out** — retrospective, savings realized vs. target, archive

Each phase transition is a gate that can require a sign-off (configurable by
Admin) before the project moves forward — this is the mechanism that gives
compliance-heavy environments (pharma, public sector) an audit trail without
building a full BPM engine.

## 5. Feature map by module

### 5.1 Workspace & structure

- Category/portfolio folders
- Project templates library, filterable by sourcing type and category
- Custom fields: text, number, date, currency, percentage, dropdown, person,
  supplier-reference
- Tags/labels

### 5.2 Task & project management (the generic engine)

- Tasks, subtasks, dependencies (finish-to-start etc.)
- Views: List, Kanban/board (by stage), Gantt/timeline, Calendar, Grid/table,
  cross-project Portfolio view
- Milestones with target dates and status
- Recurring tasks (e.g., quarterly vendor review)
- Assignees, followers/watchers, priority levels
- Configurable status workflows per phase
- Lightweight approval/sign-off at gate transitions
- File attachments with version history
- Comments, @mentions
- Full activity feed / audit trail per project
- Global search (projects, tasks, suppliers, documents)

### 5.3 Procurement-specific fields and views

- Sourcing-event-type field (RFI/RFQ/RFP/RFT/RFS) with inline definitions
- Kraljic quadrant classification field, suggesting governance rigor
- Configurable category taxonomy field
- Estimated spend / contract value field
- Savings-target vs. realized-savings fields — cost reduction, cost
  avoidance, incentive value, mirroring the "benefit bank" model some
  procurement organizations use to track savings and incentives against a
  documented baseline *(source: UC Davis)*
- Portfolio sourcing-pipeline board: one board showing every active sourcing
  project across the whole category portfolio (Identify Need → RFI → RFQ/RFP
  → Evaluation → Negotiation → Award → Contracted) — this is the direct
  answer to the cross-team duplicate-sourcing visibility gap noted above
- Sourcing calendar: submission deadlines, Q&A windows, evaluation-panel
  dates

### 5.4 Supplier / vendor directory (lightweight — not a purchasing master record)

- Name, category tags, primary contact(s), tier
  (strategic/preferred/transactional), status
- Relationship owner
- Linked projects (every sourcing event, contract, review touching this
  supplier)
- Attachments (due-diligence docs, certifications, stored as references)
- Notes/history log, manual risk flags
- Explicitly not included: price catalogs, PO history, invoice matching,
  payment terms

### 5.5 Supplier evaluation / scorecards

- Configurable weighted scoring templates, matching common practice of
  scoring price and value, product or service quality, on-time delivery
  performance, customer service and responsiveness, regulatory compliance,
  and financial and supply-chain risk as weighted criteria *(source:
  Business in a Box)*
- Side-by-side comparison view for shortlisted suppliers
- Multiple independent evaluators, aggregated/averaged; optional blind
  scoring (hide supplier identity and other scores until reveal)
- Separate recurring performance scorecard (ongoing, trend view) distinct
  from the one-time selection scorecard
- Pass/fail gate criteria (e.g., mandatory certifications) kept separate from
  weighted scoring

### 5.6 Contract & obligation tracking (lightweight — not CLM)

- Contract reference record linked to project + supplier: start/end date,
  renewal-notice window, auto-reminder
- Key obligation/date tracker (SLA reviews, certificate expiry, price-review
  dates) modeled as recurring tasks
- Signed-document storage/versioning (store, don't generate or sign)
- Renewal/termination decision workflow as a task chain

### 5.7 Risk & governance

- RAID log per project — risks, assumptions, issues, and decisions tracked in
  one place, each with a named owner, so the team has a single source of
  truth instead of chasing information across email threads *(source: Asana)*
- RACI matrix per project or phase — clarifying who is Responsible,
  Accountable, Consulted, and Informed, distinct from the RAID log's purpose
  *(source: Asana)*
- Stakeholder register (name, role, interest/influence, communication
  preference)
- Approval/sign-off audit trail at every gate
- Configurable compliance checklists (e.g., conflict-of-interest declaration,
  ESG questionnaire completion — tracked as checklist items, not a policy
  engine)
- Immutable per-record activity log

### 5.8 Reporting & dashboards

- Project status dashboard (RAG status, % complete, upcoming deadlines)
- Portfolio/category dashboard — every active project across categories,
  addressing the visibility gap directly
- Savings roll-up (target vs. realized, by category/quarter)
- Cycle-time reporting (average days per phase, e.g., RFP-issue to award)
- Supplier performance trend charts
- Exportable PDF/Excel reports for steering-committee packs
- Custom dashboard builder (chart, list, count, calendar widgets)

### 5.9 Collaboration

- Comments/@mentions at task, project, and supplier level
- Notifications: in-app, email, optional Slack/Teams webhook
- Shared vs. personal saved views/filters
- External/guest access — open question, see below

## 6. Permissions matrix (Admin / Member / Viewer)

A useful reference point here: several tools converge on keeping this
deliberately simple — usually just admin, user, and viewer roles at the base,
and layering per-project overrides on top only if needed (Asana, for
instance, lets a project have its own admin, editor, commenter, or viewer
roles independent of org-wide role, with the highest applicable access always
winning). Suggestion: start simple and only add per-project overrides if real
usage demands it. *(sources: Medium, Asana Help Center)*

| Capability | Admin | Member | Viewer |
|---|---|---|---|
| Workspace settings, templates, custom fields | Full | None | None |
| User management / role assignment | Full | None | None |
| Create projects | Full | Configurable (see open Q3) | None |
| Edit/delete projects | Full | Edit within assigned projects; delete = archive request only | None |
| Tasks (create/edit/assign) | Full | Full, within assigned projects | View only |
| Supplier directory | Full | Edit (scope: owned records or all — open Q) | View only |
| RAID / RACI entries | Full | Full, within assigned projects | View only |
| Scorecards | Full | Full, within assigned projects | View only |
| Comments | Full | Full | Configurable — allowed or not (open Q2) |
| Approval/gate sign-off | Full | Can submit; self-approval blocked by config | None |
| Reports/dashboards | Full, plus export | View, limited export | View only |
| Documents | Full | Upload/edit within assigned projects | View/download only |

## 7. Offline-first / sync architecture

Principle: the local device is the primary read/write store; the server
replicates and backs up rather than gatekeeping every action — this is the
local-first architecture pattern where reads are instant with no network
round-trip, writes commit locally first and sync after, and the server's job
is replication between peers rather than being the sole source of truth.
This matters practically: it's what makes offline genuinely first-class
instead of a bolted-on cache layer.

Recommended approach by data type:

- **Scalar fields** (status, due date, assignee, score value): per-field
  last-write-wins, but using a logical timestamp rather than wall-clock time,
  since device clocks drift.
- **Ordered lists** (task order within a board column): a lightweight
  sequence CRDT or fractional-indexing scheme — full text-editing CRDTs like
  Automerge or Yjs are likely overkill here unless the tool grows genuine
  rich-text collaborative documents.
- **Append-only data** (comments, activity log): no merge logic needed at all
  — these never conflict by nature.
- **Free-text fields edited concurrently** (task descriptions, RAID notes):
  last-write-wins plus a visible "this was also edited by X" banner and both
  versions kept in history, rather than a silent overwrite — treating
  concurrency as something to surface rather than something to hide, since
  silently discarding one person's edit is the actual failure mode worth
  avoiding.
- **Deletions**: tombstone the record and retain it until all clients confirm
  sync, then garbage-collect — this avoids the classic bug where a deleted
  item gets resurrected because an offline device syncs back in with an
  update to something the server already removed.
- **Sync transport**: incremental delta sync — client sends its last-known
  timestamp, server returns only what changed since then, keeping payloads
  small on reconnect.
- **Sync status UI**: per-record "last synced" indicator, a pending-changes
  counter, and a manual "sync now" trigger — never leave the person guessing
  whether their offline edits actually made it up.
- **Permission enforcement offline**: cache the last-known role locally and
  enforce it client-side; reconcile on reconnect if an Admin changed
  someone's role while they were offline (this needs an explicit rule).

What must work fully offline: creating/editing tasks, RAID/RACI updates,
scorecard entry, viewing the supplier directory and historical data, queuing
file attachments for upload.

What can degrade gracefully offline: cross-workspace search (may be limited
to locally cached data), org-wide aggregate reports (compute per-project
locally instead, reconcile on sync).

## 8. Out of scope for v1 (explicit, so it doesn't creep in)

- Purchase order creation, approval routing, or invoice/3-way matching
- E-auction / competitive bidding engine
- Contract drafting or e-signature (DocuSign-style)
- Punch-out catalogs or price-list management
- ERP/P2P system integration
- SSO/SAML (worth revisiting once there's a real multi-org deployment need)

## 9. Open questions for review

1. Purely internal-facing, or do suppliers ever get limited external access
   (e.g., submitting an RFP response directly)? This changes the security
   model significantly.
2. Should Viewer be strictly read-only, or allowed to comment (an Asana-style
   Viewer/Commenter split)?
3. Can Members create new projects, or is project creation an Admin-only
   governance checkpoint?
4. Workspace-wide roles only, or per-project overrides (a Member becomes
   Viewer on one sensitive project)?
5. How rich do "documents" need to be — file attachments with versioning, or
   in-app collaborative pages (Notion-style) for RFP drafts and meeting
   notes?
6. Single workspace with category folders, or genuine
   multi-workspace/multi-tenant support for separate client engagements?
7. What's the realistic concurrency profile — how often will two people
   actually edit the same record offline at the same time? This determines
   whether investing in a real CRDT library is worth it versus
   last-write-wins with a conflict banner.
8. Do savings/spend fields need multi-currency support, given a multi-market
   European context?
9. Are performance scorecards recurring/automated (auto-spawn a quarterly
   review task) or purely ad hoc?
10. What's the audit-trail retention requirement, and is there a specific
    regulatory driver (public-sector tender rules, internal pharma compliance
    policy) dictating it?
