# Pacwoods

Wood-cutting, edging, job-tracking and workshop management platform for
Pacwoods, an industrial wood processing centre.

**Status: Phase 3 (cutlists) done.** Accounts, clients, jobs, materials, the
cutlist editor, cutting plans and job cards work; production queues come next. The plan, domain model, decisions and open questions are
in [`docs/phase-0-architecture.md`](docs/phase-0-architecture.md).

## Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4,
shadcn/ui, Hugeicons, Poppins. MongoDB Atlas via Mongoose 9 and Auth.js v5
(see ADR-1 and ADR-2 in the Phase 0 document).

## Running it

```bash
npm install
cp .env.example .env.local          # fill in MONGODB_URI and AUTH_SECRET
npm run db:ping                      # checks the Atlas connection
npm run db:indexes                   # creates the unique/TTL indexes
npm run create-super-admin -- --name "Full Name" --email you@example.com
npm run materials:standard           # optional: common sheet materials
npm run dev                          # http://localhost:3000
```

The Super Admin command prints a temporary password once. Sign in with it and
you will be made to choose your own. Do not save it in a file.

Checks before calling anything done:

```bash
npm run build      # production build + typecheck
npx eslint src/ tests/ scripts/
npm test           # unit + integration (integration uses the pacwoods_test database)
```

Never commit secrets: `.env.local` is ignored; `.env.example` holds placeholders only.

## Brand

`docs/brand/logo-sample.jpeg` is the reference photo of the workshop sign. The
mark in `src/components/Logo.tsx` and `src/app/icon.svg` is an SVG redrawing
of it; swap in the master artwork when it is available.

## Project rules

See [`AGENTS.md`](AGENTS.md).
