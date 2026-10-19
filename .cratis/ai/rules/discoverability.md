---
applyTo: "**/*.{md,mdx,html,astro}"
paths:
  - "**/*.md"
  - "**/*.mdx"
  - "**/*.html"
  - "**/*.astro"
---

# Writing content that people and assistants can find

Readability comes first. If a change for search engines or AI assistants makes a page harder to read, drop the change. Voice, structure and examples stay with [writing-cratis-docs.md](./writing-cratis-docs.md), [editing-cratis-docs.md](./editing-cratis-docs.md) and [documentation-structure-and-formatting.md](./documentation-structure-and-formatting.md); this rule adds only what they do not cover. Before publishing a page, post or package, use **cratis-discoverability**.

## Every page, post and README

- **Define first, where a definition belongs.** Landing pages, product index pages, glossary entries, READMEs and package descriptions open with one self-contained sentence: "X is a <category> for <audience> that <does>."
- **Docs tutorials, getting-started pages and explanations follow [writing-cratis-docs.md](./writing-cratis-docs.md)**: scenario first, pain before relief. Their answer-first, self-contained definition goes in the frontmatter `description`, which serves search and AI. Where it reads naturally, one definition sentence may follow the opening scenario. writing-cratis-docs wins on voice and structure.
- **Title and description are written by hand.** Title with the distinguishing term first: 50-60 characters for blog and landing pages, 20-60 for docs and reference pages; a README H1 that is the product name is fine. Description is one sentence of 60-160 characters, never over 160, and not a copy of the title or of another page's description.
- **Name things one way.** The first mention is the full name ("Cratis Chronicle"), later mentions may shorten it. Use the canonical names in the **cratis-discoverability** entity reference, and do not call the platform "Cratis.io".
- **Links name their destination.** Link text says what is behind it. Outside the docs site, link docs with the absolute canonical host `https://www.cratis.io/...`, never the bare `cratis.io`.
- **Images carry alt text.** Describe the content. Use an empty `alt=""` only for decoration.
- **No keyword stuffing, no filler for length, no text hidden from readers.** A page is done when it is complete.

## Sites and packages

- Public pages need a canonical link, one `<h1>`, Open Graph tags, valid JSON-LD that describes visible content, a sitemap entry and a `robots.txt` that allows crawling. Add no new `HowTo` or `FAQPage` markup; keep the visible Q&A.
- `llms.txt` is an optional index. Never claim it improves ranking. See **cratis-llm-friendly-documentation**.
- Package metadata (`Description`, `PackageProjectUrl`, `PackageTags`, npm `description`, `homepage`, `keywords`) and the README opener use the same definition sentence, and the project URL points at the docs page `https://www.cratis.io/<product>/`.
- State only facts the repository supports: versions, licenses, limits. The claim gate in `BRAND.md`, `MESSAGING.md` and `SITE.md` still applies.
