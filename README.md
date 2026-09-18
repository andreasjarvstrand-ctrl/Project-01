# Productive

Project management that speaks procurement's language — sourcing events with
stage-gates, supplier scorecards, RAID logs, Kraljic classification, and
contract renewal tracking, built on a general-purpose task engine. It is a
PM tool, **not** a purchasing system: no POs, no invoices, no e-signature
(see `docs/feature-map-v1-draft.md` §0 for the scope boundary).

Built with Next.js 16, Prisma 7, and SQLite.

## Setup

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Login via OTP sent to your email (printed to the server console in dev mode).

Seeded demo users (Nordic Health Group Procurement workspace):

| Email | Role |
|---|---|
| `dana@productive.dev` | Admin — category manager |
| `sofia@productive.dev` | Member — sourcing specialist |
| `marco@productive.dev` | Member — buyer |
| `viktor@productive.dev` | Viewer — legal counsel, named gate approver |

## What's implemented

Design docs: `docs/feature-map-v1-draft.md` (feature map) and
`docs/feature-map-v1-redline.md` (the redline it was built against).

- **Projects with per-type stage-gate lifecycles** — six project types, each
  with its own default stage set; gates with *named approvers* (any user,
  any role — legal can sign off as a Viewer), advance blocked until sign-off,
  rollback with a required audited reason, stage entry/exit timestamps.
- **Portfolio pipeline board** — every active project by canonical phase; a
  view over the stage-gate data, never a second status field (redline A1).
- **Tasks** — subtasks, finish-to-start dependencies (cycle-checked,
  completion-blocking), milestones, priorities, assignees, due dates.
- **RAID log, stakeholder register with RACI**, per-project.
- **Supplier directory** — tiers, statuses, category tags, contacts,
  relationship owner, risk flags, linked projects and contracts.
- **Scorecards** — weighted templates with separate pass/fail gate criteria;
  scoring rounds with multiple evaluators, optional blind mode (scores and
  supplier identities private until an explicit privileged reveal).
- **Contracts** — reference records with renewal-notice deadlines
  (end date − notice window), overdue flagging on the dashboard radar, key
  date/obligation tracking.
- **Savings tracking** — target vs. realized with type (reduction /
  avoidance / incentive) and baseline note; multi-currency as
  (amount, ISO code) with no FX engine (redline Q8).
- **Reports** — savings by category, cycle time per phase from stage
  timestamps, pipeline counts, supplier performance; CSV export.
- **Roles** — Admin / Member / Viewer; viewers-can-comment and
  members-can-create-projects workspace toggles; append-only activity log
  with dual timestamps on every mutation.

## Not yet implemented (deliberately)

- **Offline-first sync client** — the largest deferred piece. The schema is
  shaped for it (cuid IDs client-generatable offline, `workspaceId` on every
  table, append-only activity log, server-authoritative actions isolated in
  server code); the op-log sync layer per redline §D is the next milestone.
- File attachments/document versioning, private projects, supplier merge,
  Gantt view, custom dashboard builder, PDF exports, Slack/Teams webhooks,
  SSO — see the redline's v1.1/deferred lists.

## Development notes

- SQLite via Prisma 7 driver adapters: connection config lives in
  `prisma.config.ts` (CLI) and `src/lib/db.ts` (runtime), not in the schema.
- SQLite has no enums — enum-like fields are strings validated against
  `src/lib/domain.ts`.
- Money is stored as whole currency units (Int) + ISO 4217 code.
- Server-action error redirects must be built with `errRedirect()`
  (`src/lib/format.ts`) — raw non-ASCII in a redirect URL breaks the
  `x-action-redirect` header.
- End-to-end verification recipe: `.claude/skills/verify/SKILL.md`.
