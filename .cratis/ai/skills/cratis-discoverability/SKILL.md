---
name: cratis-discoverability
description: Run the pre-publish check that makes Cratis content easy to find in search and AI answers without making it harder to read - a docs page, blog post, landing page, README or package metadata (title, description, opening definition, canonical links, entity names, alt text, structured data). Use when about to publish or review content for discoverability, SEO, AEO or GEO, or when writing package descriptions and README openers. Not for page voice and structure (cratis-documentation-writing), llms.txt design (cratis-llm-friendly-documentation), distribution plans (cratis-developer-marketing) or length decisions (cratis-content-length).
license: MIT
---

# Discoverability before you publish

Discoverability is a property of good content: a clear definition, an honest title, one name per
thing and working links. The always-on rule is [discoverability.md](../../rules/discoverability.md);
this skill is the procedure to run on the finished draft. If a fix makes the page worse to read,
drop the fix and say so.

## Procedure

1. Name the content type: docs page, blog post, landing page, README or package metadata.
2. Name the reader's one job and, for docs, the page type (tutorial, how-to, reference, explanation).
3. Apply the checks for that type below. Fix the draft; do not annotate it.
4. For a built site, run the checker and fix errors; warnings are judgment calls to report.
5. Report what was changed, what was left alone and why.

Read `references/page-checklist.md` for the full per-type checklist and the field lengths.

## Checks by content type

- **Docs page.** The `description` is written by hand as one self-contained
  definition or outcome sentence. Tutorials, getting-started pages and explanations follow
  `writing-cratis-docs` (scenario first); the definition lives in the `description`, and one
  definition sentence may follow the opening scenario where it reads naturally. `writing-cratis-docs`
  wins on voice and structure. Product index pages open with the definition sentence.
  Reference pages stay terse: title is the exact name plus its product, no question headings, no
  intro. Titles are unique across the site and name the product ("Chronicle projections").
- **Blog post.** The title states the topic in the words a reader would search. The intro gives the
  conclusion in two sentences. Show the named author and date, add `lastUpdated` only for real
  changes, link the owning docs pages with `https://www.cratis.io/...`, keep `description` apart
  from the card `excerpt`.
- **Landing page.** One primary term in the title, the `<h1>` or the first paragraph, and a
  one-sentence definition above the fold. Brand lines stay; pair them with a category term in the
  title and description. Respect the claim gate in `BRAND.md`, `MESSAGING.md` and `SITE.md`.
- **README.** The H1 may be the product name ("Cratis <Product>"). The first sentence defines the product in 15-35 plain
  nouns, with no logo-only or metaphor opener. Links are absolute; link the docs page.
- **Package metadata.** One sentence naming what the package is and which Cratis product it belongs
  to, identical to the README opener. `PackageProjectUrl` and `homepage` point at the docs page, not
  only at GitHub. Read `references/package-metadata.md` for the field map.

## Names

Use the canonical names, one per concept, and the first-mention rule. Read
`references/entities.md` when naming a product, writing a definition sentence or filling `sameAs`.
Do not invent a name, URL, maturity word or claim that the references do not state.

## Structured data

Describe only what is visible on the page, one `@graph` per page, stable `@id`s. Add no `HowTo` and
no new `FAQPage`. Read `references/structured-data.md` for the patterns and what each page type
gets. Do not name people in structured data.

## Checking a built site

For a built static site (Astro `dist/` or a plain-HTML repository root), run with Node.js:
`node <skill-directory>/scripts/verify-discoverability.mjs --root <dir> --site <https://host>`.
It reports `<html lang>`, title, description, canonical host, `<h1>` count, JSON-LD parse errors,
`robots.txt`, the sitemap and `llms.txt` structure. Errors exit 1; warnings do not. Pass
`--warn-only` to downgrade errors and `--require-llms` where the site ships `llms.txt`.
Read `scripts/verify-discoverability.mjs` only when changing the checker.

## Pitfalls

- Question headings everywhere: use them only where they read naturally (concept pages, FAQs,
  comparisons, blog), never on reference pages or tutorial steps.
- Padding to a word count: there is no minimum length; a complete page is done.
- Apex `https://cratis.io/` links: the docs host is `https://www.cratis.io`.
- A description that repeats the title or a sibling page's description.
