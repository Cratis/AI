# Page checklist

## Contents

- Field targets
- Every page
- Docs pages
- Blog posts
- Landing pages
- READMEs
- Before publishing a site change

## Field targets

Lengths are targets, counted in characters including any site suffix.

| Field | Target |
| --- | --- |
| Title | 50-60, distinguishing term first. Docs and reference pages: 20-60 |
| Meta description | 120-155, never over 160; the point is in the first 120 |
| Lead answer passage | 40-60 words, names its subject, one key property, one limit |
| Heading | Under about 70 characters |
| `og:image` | 1200x630, under 200 KB, with `og:image:alt` |

## Every page

- [ ] One reader job. For docs, one page type: tutorial, how-to, reference or explanation.
- [ ] Title unique, distinguishing term near the front.
- [ ] Description written by hand; not the title, not another page's description.
- [ ] The first paragraph answers what the page is or achieves in one self-contained sentence.
- [ ] Canonical names; first mention uses the full "Cratis X" form.
- [ ] Facts, numbers and comparisons carry a source or a date; nothing beyond the claim gate.
- [ ] Links have descriptive text. Root-relative inside the docs site, absolute
      `https://www.cratis.io/...` elsewhere.
- [ ] Images have alt text (empty only when decorative) and sensible size.
- [ ] Linked from at least two other pages and from the right hub; no orphan.
- [ ] Read aloud once: if it sounds written for a crawler, rewrite it.

## Docs pages

- Concept page: definition first; then why it exists, when to use it, when not to, how it works.
  H2s such as "What is X" and "When to use X" only where they fit. No H1 in the body.
- Tutorial: title names the outcome and starts with a verb; opening "By the end you will have X
  running"; prerequisites and versions up front; one visible result per step; "Last updated" and the
  version it applies to.
- How-to: the task as the title; goal, prerequisites, numbered steps, a done check, the two likely
  failures; versions stated.
- Reference: the title is the exact name with its product; first sentence says what it is for;
  tables and signatures; stable anchors; no intro, no pitch. Merge or enrich near-empty stub pages.

## Blog posts

- [ ] Title states the topic; series name goes in a `series` field or at the end.
- [ ] Two-sentence conclusion up front; "when this is the wrong fit" where it applies.
- [ ] Named author where agreed (`cratis-team` only for company announcements), date, `lastUpdated`
      only on real changes.
- [ ] At least one internal link to the owning docs page; tags reused from the existing list, no
      singleton tags; a cover image with alt text for posts likely to be shared.

## Landing pages

- [ ] One primary term in title, `<h1>` or first paragraph; one-sentence definition above the fold.
- [ ] Description differs per page and is not a 300-character paragraph.
- [ ] No testimonials, numbers, customers, prices or maturity claims the claim gate does not allow.
- [ ] Norwegian pages are written natively, keep established English technical terms, link to the
      English page with `hreflang`, and are not machine-translated and published unreviewed.

## READMEs

- [ ] H1 "Cratis <Product>"; first sentence is the definition (15-35 words, no metaphor).
- [ ] Then install, a minimal working example, a link to `https://www.cratis.io/<product>/`,
      license and how it relates to the rest of Cratis.
- [ ] GitHub About text equals the README opener (80-160 characters); website is the docs page;
      topics include `cratis` plus category terms.

## Before publishing a site change

- [ ] Title, description, canonical, Open Graph and JSON-LD present and unique on changed pages.
- [ ] Sitemap lists new pages; `robots.txt` unchanged unless intended.
- [ ] JSON-LD validates; no `HowTo`; no new `FAQPage`.
- [ ] The content is in the raw HTML the server returns, not only rendered by JavaScript.
- [ ] Internal links resolve; no apex `cratis.io` links.
- [ ] A real HTTP 404 for unknown URLs; redirect stubs keep a canonical and stay out of the sitemap.
