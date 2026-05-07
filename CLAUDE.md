# EasyReview — SEO/GEO Operator Tool

This is a Next.js 15 app that complements the wiki at `../SEO:GEO B&M Business/`. It lets a B&M operator (or wiki maintainer on their behalf) categorize incoming GBP reviews against the wiki's 5-category framework, draft replies via Gemini Flash, and commit approved replies back to the wiki repo as briefs.

## Stack

- Next.js 15 App Router · TypeScript · Tailwind 4 · framer-motion · lucide-react
- PocketBase JS SDK (auth + persistence)
- @google/generative-ai (Gemini 2.0 Flash)
- @octokit/rest (wiki commit)
- vitest for unit tests

## Commands

- `npm run dev` — local dev server on :3000
- `npm run build` — runs sync-wiki then next build
- `npm run sync-wiki` — bake wiki templates → src/data/templates.json
- `npm test` — vitest

## Source-of-truth coupling

The wiki at `../SEO:GEO B&M Business/wiki/concepts/review-response-templates.md` is the **source of truth** for templates and the 5-category framework. The app consumes them via `npm run sync-wiki` (build-time bake into `src/data/templates.json`). Edit the wiki, then re-run sync, then redeploy.

Approved replies are committed back to the wiki repo via Octokit as `briefs/<YYYY-MM-DD>_<id>.md` files. The wiki maintainer's laptop pulls those briefs via a Claude Code SessionStart hook (set up in the wiki workspace's `.claude/settings.json`).

## Specs and plans

- Spec: `docs/superpowers/specs/2026-05-07-easyreview-seogeo-transform-design.md`
- v0 plan: `docs/superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md`

## Hard rules

- Never auto-post a reply. The "Post" button click is the only path to a write.
- Never log customer names from reviews to error toasts or console.
- Never commit `.env.local` or any file containing the GitHub PAT, Gemini API key, or PocketBase admin password.
- The 1star_fake category is NOT pre-drafted by AI — operator decides manually per wiki policy.
- v0 has no Google OAuth. v1 plan adds it. Don't try to rush v1 features into v0.
