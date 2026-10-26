# Pacwoods

Wood-cutting, edging, job-tracking and workshop management platform for
Pacwoods, an industrial wood processing centre.

**Status: Phase 0 (discovery and architecture).** The app currently serves a
branded holding page. The plan, domain model, decisions and open questions are
in [`docs/phase-0-architecture.md`](docs/phase-0-architecture.md).

## Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4,
shadcn/ui, Hugeicons, Poppins. MongoDB Atlas via Mongoose 9 and Auth.js v5
(see ADR-1 and ADR-2 in the Phase 0 document).

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build + typecheck
npx eslint src/
```

Copy `.env.example` to `.env.local` once Phase 1 introduces it. Never commit
secrets.

## Brand

`docs/brand/logo-sample.jpeg` is the reference photo of the workshop sign. The
mark in `src/components/Logo.tsx` and `src/app/icon.svg` is an SVG redrawing
of it; swap in the master artwork when it is available.

## Project rules

See [`AGENTS.md`](AGENTS.md).
