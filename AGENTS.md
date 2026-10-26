# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

---

# Pacwoods project rules

The block above is managed by `next dev`; everything below it is ours and
survives regeneration. The architecture, domain model and open questions are in
[`docs/phase-0-architecture.md`](docs/phase-0-architecture.md).

## Before saying it works

- `npm run build` and `npx eslint src/` must both be clean. The build runs
  TypeScript; lint is not part of it.
- Business rules (queues, transitions, permissions, the cutting engine) need
  automated tests, not a manual click-through.
- Claims about layout or interaction need a browser, not a typecheck.
- Unit tests do not exercise Auth.js itself. After touching `src/auth.ts`,
  sign in for real (`next start` with `AUTH_URL` set, then POST to
  `/api/auth/callback/credentials`): values returned from `authorize` must be
  structured-cloneable, so no Mongoose arrays or documents.

## Naming

- The product is **Pacwoods** in copy. The logo letters it "PaC WOODS"; that
  styling belongs to the `Logo` component only.

## Business rules live on the server

- Every privileged mutation checks the session, role, capability and resource
  ownership on the server. Hiding a button is not authorization.
- Never trust client-supplied roles, ownership, queue positions, durations,
  prices or statuses.
- Status changes go through the transition functions in `src/server/workflow`
  and write a timeline event. Nothing sets a status field directly.
- Queue starts are atomic compare-and-set updates. Never read-then-write.
- No mock data, fake progress or placeholder metrics in anything a user sees.

## Do not invent business decisions

Prices, edging compensation formulas, FIFO scope, retention periods and other
items under "Unresolved business rules" in the Phase 0 document are for the
business owner. Leave a marked gap and ask.

## Design

- Palette (sampled from the sign, see `globals.css`): charcoal `#1B2328`,
  gold `#D99E56`, steel `#E7E8EA`. Gold is a fill or text on charcoal, never
  text on white (2.34:1); use gold-deep `#8A5A1C` there.
- Poppins only. Hugeicons only, no second icon set.
- shadcn/ui components are added with `npx shadcn@latest add <name>`; the CLI
  is not a project dependency. It writes `import { cn } from "cn"` and installs
  an unrelated npm package called `cn`: afterwards, point the import at
  `@/lib/utils` and `npm uninstall cn`.
- No decorative gradients, glows or fake charts.
- The public homepage (`/`) is the exception for atmosphere: wood-grain
  texture, motion and scroll reveals are allowed there (all switched off for
  reduced motion; content must stay visible without JavaScript). App screens
  stay flat.
- Buttons on charcoal or gold grounds use the `gold`, `dark` and `onDark`
  button variants, not a `className` background override (the default
  variant's background wins).
- Check layout with screenshots: headless Edge
  (`--headless=new --user-data-dir=<fresh dir> --screenshot`, one at a time
  with `Start-Process -Wait`). Windows clamps the window to ~500px, so test
  phones by loading the page in a 390px iframe.

## Assets

- `public/` holds only files the app references. Brand reference material
  lives in `docs/brand/`.
- Keep large binaries (video, raw photos) out of git.

## Database models

- Define every Mongoose model with `defineModel` (`src/server/db/model.ts`),
  never `mongoose.models.X ?? mongoose.model(...)`. Under `next dev` a cached
  model keeps its old schema and silently drops new fields on save.
- After adding fields that existing data needs, write an idempotent repair
  script with a dry run (see `scripts/repair-production.ts`).

## React

- No `setState` in an effect body; the lint rule is an error. Use
  `useSyncExternalStore` for a hydration-time value.

## Windows, and this shell

- sharp holds its source file open: read into a Buffer before writing back to
  the same path, or the write fails with `UNKNOWN`/`EPERM`.
- Git Bash heredocs and `node -e` break on apostrophes. Write the script to a
  file and run the file.
- Stop `next start` before rebuilding; it holds `.next` open.
