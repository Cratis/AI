---
name: cratis-documentation-writing
description: Plan, write, and improve user-centered Cratis documentation with a clear reader journey and one primary Diátaxis purpose per page. Use for product docs, tutorials, how-to guides, reference, explanations, and documentation reviews. For executable examples use cratis-technical-examples; for release notes use cratis-release-notes. Do not invent APIs or publish content.
license: MIT
---

# Documentation writing

A developer arrives with a job to do, not with an interest in our repository
structure. Start from that job: what did they try, what stopped them, and what
would let them know they succeeded? Use [Diátaxis](https://diataxis.fr/)
as a compass for each page's primary purpose, not a purity test. This skill
governs content and reader journeys; the owning repository governs page
placement, navigation, and rendering.

## Classify before writing

Determine which quadrant the page belongs to before drafting:

| Type | Orientation | Analogy | When to use |
| --- | --- | --- | --- |
| **Tutorial** | Learning | A lesson | Guide a newcomer step-by-step to a successful first outcome |
| **How-to guide** | Problem-solving | A recipe | Show an experienced user how to accomplish a specific task |
| **Reference** | Information | A dictionary | Describe the technical machinery — APIs, attributes, configuration |
| **Explanation** | Understanding | A discussion | Clarify *why* something works the way it does, trade-offs, architecture |

Rules per type:

- **Tutorial** — lead a newcomer through one realistic, threaded outcome.
  Each step has a visible result. Briefly explain the invisible effect of a
  step, then link to an explanation for deeper theory; do not interrupt the
  lesson with a reference dump. Show the smallest configuration that runs
  before presenting options; put host and configuration alternatives in linked
  how-to guides.
- **How-to guide** — assume competence. State the goal, list prerequisites,
  give the steps, done. No teaching.
- **Reference** — exhaustive within its declared scope and terse. For each
  public option or API, cover type, required/optional status, default, valid
  values, return behavior, errors and compatibility where applicable. State
  scope and link to a working usage example; do not turn it into a lesson.
- **Explanation** — no steps. Discuss concepts, trade-offs, and design
  decisions. Diagrams are welcome here.

A brief prerequisite or explanation may serve the main journey. If a reader
also needs an exhaustive lookup, link a reference page rather than burying it
in the lesson. Resolve routine audience or type choices from the request
and neighboring pages; ask only when the alternatives change the outcome.

## Work from the reader outward

1. Find the authored source, neighboring pages, existing user entry points,
   and current product behavior. Do not edit generated site copies. Identify
   whether the reader is new, migrating, troubleshooting, or looking up an API.
2. Write the question they came with and the success signal in one sentence.
   Draft a title and first paragraph that make the problem and payoff clear;
   avoid opening with an abstract product definition or an internal type name.
3. Trace a short route from that page to one clear 'start here' entry,
   targeted recipes, and exact reference. Give different languages or hosts
   their own procedures when a shared path cannot be run as written. A
   'coming from X' bridge should map familiar concepts to the new workflow,
   not replace it.
4. Draft in workflow order. For a tutorial, use one working domain throughout,
   show what to run and what appears, and recap before adding another concept.
   For a how-to, keep only what the specific task needs. Link out for details.
5. Read the rendered page as a newcomer: could they find it, begin without
   hidden prerequisites, recover from a common mistake, and recognize success?
   Then check claims, examples, accessibility, links, and the owning gates.

Use support questions and user feedback as evidence: ask what they searched
for, where they looked, and which step failed. Repair the entry link, wording,
or example as appropriate; adding another FAQ entry alone may not fix discovery.

## Writing style

The voice is **direct, practical, and opinionated** — an experienced colleague
explaining something to a capable developer, confident but never condescending.

- **Active voice, present tense.** "Chronicle appends the event", not "The
  event is appended by Chronicle."
- **Second person.** "You configure…", not "One configures…" or "It is
  possible to configure…".
- **Lead with the reader's problem and payoff.** Explain why a capability
  matters before its configuration, except in a terse how-to or reference.
- Use headings, lists, and code blocks to organize content; dense paragraphs
  lose readers.
- Focus on public behavior. Explain what happens behind an example when the
  reader needs it to understand the result, without turning the page into an
  internal implementation manual.
- Teach the intended idioms: show the conventional shape of a solution and
  explain why a tempting non-idiomatic approach causes trouble. Distinguish a
  framework requirement from a house convention; avoid making a workaround the
  first example a newcomer copies.
- State limitations, maturity, compatibility, and when the simpler approach
  is preferable. Link to third-party docs instead of retelling them.
- Vary sentence and paragraph rhythm; avoid templated openings and filler.
  A voice edit must never weaken a technical caveat or invent experience.
- **American English only**: `color` not `colour`, `behavior` not `behaviour`,
  `organize` not `organise`, `initialize` not `initialise`.

## AI-assisted drafting

Use AI to find gaps, compare terminology and review a draft, but do not let
plausible generated prose decide what problem the product solves. Ground the
reader journey in observed use cases and have the owning maintainer review
structural changes. A style pass cannot establish technical correctness.
Do not rewrite an entire corpus into one repeated template.

For machine-readable delivery and retrieval checks, use
**cratis-llm-friendly-documentation**; publishing `llms-full.txt` alone does
not prove that an assistant can find the right page or cite it accurately.

## Examples and maintenance

Use **cratis-technical-examples** to choose between a short verified
illustration and a snippet extracted from compiling, tested sample source.
Never transcribe an API from memory, hand-translate an unsupported client, or
claim a pasted block is runnable when it requires unstated setup. Show the
command and observable output for a substantial walkthrough.

Edit the *authored* file, never a synced copy. The Cratis site derives each
product page's edit link from that source path, so don't hand-author
`editUrl` in product frontmatter. Recheck examples against the supported version when that version changes.
A review of docs is not complete just because the site builds: syntax and
behavior are different checks.

## Diagrams

Use [Mermaid](https://mermaid-js.github.io/mermaid/#/) for architecture
(`graph TD` / `graph LR`), sequence flows (`sequenceDiagram`), and state
transitions (`stateDiagram-v2`). A diagram replaces a paragraph of topology
prose; it does not decorate one.

## Contextual awareness

- Read the existing documentation around the page you are writing first, and
  match its tone, style, and terminology. If it is "event source" there, it is
  "event source" everywhere.
- Do not copy content from existing pages unless explicitly asked; link
  instead.
- Do not fabricate URLs or version numbers — link only to resources you can
  verify exist.

## Inspiration, not a template

Jeremy Miller describes user-centered journeys, tutorial-to-reference links,
source-checked snippets, and a quick edit/publish loop in his
[OSS-community account](https://jeremydmiller.com/2026/07/08/things-that-have-worked-for-our-oss-community/)
and [documentation essay](https://www.linkedin.com/pulse/effective-oss-documentation-jeremy-miller-bh1ac/).
His account is experience, not evidence that a particular site generator or AI
model causes better documentation. Borrow the reader and maintenance habits;
do not copy Wolverine's information architecture onto a different product.

## Completion checklist

A page is done when:

- The page has a deliberate primary purpose; short supporting context helps
  the reader proceed, while substantial digressions link to their own pages.
- The audience and their goal were identified before writing, and the first
  screen serves that goal. The first working path needs no unexplained setup
  or up-front choice among configuration alternatives.
- Examples teach intended idioms and identify relevant traps without turning
  a tutorial into an exhaustive list of alternatives.
- Examples are source-verified, complete at their stated scope, and show a
  checkable result; longer examples come from compiling sample or spec source.
- The entry point, terminology, and next-step links fit the surrounding docs.
- All internal links resolve; all external links are real.
- Mermaid blocks are syntactically valid.
- The file ends with a single trailing newline.
