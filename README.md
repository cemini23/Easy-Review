# EasyReview

The operator-facing automation surface for the [SEO/GEO B&M Business wiki](https://github.com/cemini23/SEO-GEO-B-M-Wiki). The wiki is the knowledge base; this app is what a brick-and-mortar operator actually clicks on to apply it.

Vertical-agnostic — works for barbershops, dental clinics, salons, gyms, retail, restaurants, auto shops, and other single- or multi-location B&M operators.

## How the two repos pair

- **Wiki** — curated, cross-linked markdown about local SEO, GEO/AEO, reviews, GBP, social. Read by humans and by Claude. Source of truth for the 5-category review framework, response templates, and operator playbooks.
- **EasyReview (this repo)** — Next.js app that bakes the wiki's review-response templates at build time, accepts a pasted review, categorizes it, drafts a reply via Gemini Flash, and commits the approved reply back to the wiki repo as a brief markdown file. The wiki gains a feedback loop; the operator gets a tool.

## What it does (v0 paste-flow)

- Operator pastes a Google / Yelp / Facebook review into the form
- App categorizes against the wiki's 5-category framework (5★-specific, 5★-generic, 4★, 3★-mixed, 1-2★ complaint, 1★ likely-fake)
- Gemini 2.0 Flash drafts a reply using the wiki's response templates
- Operator edits, regenerates, or approves
- Approved reply is committed back to the wiki repo via Octokit as `briefs/YYYY-MM-DD_<id>.md`

v1 will add live Google Business Profile API integration so reviews flow in automatically and replies post directly. v0 stays paste-and-paste so the operator can validate the loop with no GBP write access required.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your keys (Gemini, PocketBase, GitHub PAT for the wiki repo)
2. Set up PocketBase collections per [the v0 plan, Task 8](docs/superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md)
3. Create a fine-scoped GitHub PAT with `contents:write` on the [wiki repo](https://github.com/cemini23/SEO-GEO-B-M-Wiki) only
4. `npm install`
5. `npm run sync-wiki` (bakes wiki templates into `src/data/templates.json`)
6. `npm run dev`

## Stack

Next.js 15 App Router · TypeScript · Tailwind 4 · PocketBase · Gemini 2.0 Flash · Octokit · vitest

## Specs

- Design: [docs/superpowers/specs/2026-05-07-easyreview-seogeo-transform-design.md](docs/superpowers/specs/2026-05-07-easyreview-seogeo-transform-design.md)
- v0 plan: [docs/superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md](docs/superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md)

## Hard rules

- Never auto-post a reply. The operator's Post click is the only path to a write.
- Never log customer names from reviews to console or error toasts.
- The 1★-likely-fake category is never pre-drafted by AI — operator decides manually per wiki guidance.
