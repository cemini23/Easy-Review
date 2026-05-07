# EasyReview

A vertical-agnostic review-response tool for brick-and-mortar operators. Companion app to the SEO/GEO wiki.

## What it does

- Operator inputs a Google / Yelp / Facebook review (paste-flow in v0; live GBP API in v1)
- App categorizes the review against the wiki's 5-category framework
- Gemini Flash drafts a reply using wiki-baked templates
- Operator edits / regenerates / approves
- Approved reply is committed to the wiki repo as a brief markdown file

## Setup

1. Copy `.env.example` to `.env.local` and fill in your keys
2. Set up PocketBase collections per `docs/superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md` Task 8
3. Push the wiki repo to GitHub and create a fine-scoped PAT (contents:write on that repo only)
4. `npm install`
5. `npm run sync-wiki` (bakes wiki templates into `src/data/templates.json`)
6. `npm run dev`

## Specs

- Design: `docs/superpowers/specs/2026-05-07-easyreview-seogeo-transform-design.md`
- v0 plan: `docs/superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md`
