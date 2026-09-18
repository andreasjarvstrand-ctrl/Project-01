---
name: verify
description: Build, launch, and drive Productive (Next.js + Prisma/SQLite procurement PM app) end-to-end to verify changes at the browser surface.
---

# Verifying Productive

## Build & launch

```bash
npm run build                     # production build (Turbopack); TS errors surface here
npm run db:seed                   # resets demo data — run between verification runs
npm run start > server.log 2>&1 & # serve on :3000; keep the log, OTP codes print there
```

If a previous server holds :3000 you get EADDRINUSE **inside server.log** while
curl still answers from the old build — always `pkill -f "next start"` and check
`ss -ltnp | grep :3000` before trusting a rerun.

## Login

OTP flow, no mailer: request a code on /login, then grep the server log:
`[OTP] Login code for <email>: <6 digits>` (take the last match per email).
Seeded users: dana@productive.dev (Admin), sofia@ (Member), marco@ (Member),
viktor@ (Viewer + named gate approver).

## Drive

Playwright with the preinstalled browser — do NOT `playwright install`:

```js
chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
```

Flows worth driving: dashboard gate approval (redirects to the project page,
not back to the dashboard), stage advance blocked until all approvals in,
rollback with required reason (approvals reset to PENDING), task creation +
finish-to-start dependency block, blind scorecard privacy (non-evaluators see
no scores), viewer read-only probes (/settings redirect, no mutation forms,
comments still allowed), contracts renewal-notice flags, /reports/export CSV.

## Gotchas

- `text=` selectors match invisible `<option>` elements — task titles appear in
  every row's dependency dropdown. Scope to `td:has-text(...)` or a
  `span.font-medium` filter.
- `page.content()` returns HTML-escaped markup (`&amp;`) — assert against
  `locator("body").innerText()` for text containing `&`.
- Server-action error redirects travel in the `x-action-redirect` header:
  non-ASCII in redirect URLs throws ERR_INVALID_CHAR. Use `errRedirect()` from
  `src/lib/format.ts`.
- Reseed between runs: verification mutates state (approvals, stage moves).
  The seed wipes in FK order (rounds/contracts/projects/suppliers/templates
  before workspace) because round→template and contract→supplier are Restrict.
