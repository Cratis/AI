# Skills

Skills are **detailed, step-by-step implementation guides** invoked on demand when a developer needs to perform a specific, reusable workflow. They answer *how* to do something — the exact sequence of steps, patterns, and code templates required to complete a well-defined task.

See also: [Architecture Overview](./architecture.md) · [Instructions vs Skills](./instructions-vs-skills.md)

---

## How skills work

A skill lives in **`.ai/skills/<skill-name>/SKILL.md`**. `.ai/` is the single source of truth; each assistant sees the same folder through an adapter symlink (`.github/skills`, `.claude/skills`, `.agents/skills`). Never author a skill under an adapter path — the edit is lost the next time the source changes.

A skill is NOT loaded automatically. It is invoked explicitly when a user asks for that workflow or when an agent determines the skill is needed, which is why the `description` in its front matter matters: that text is the only thing an assistant sees when deciding whether to open the skill.

Each skill:

- Has a single, well-defined purpose
- Provides step-by-step guidance
- Includes code templates and examples
- May reference supporting material in a `references/` subfolder
- May include eval cases in an `evals/` subfolder for quality measurement

---

## Skill anatomy

```text
.ai/skills/<skill-name>/
├── SKILL.md            ← The skill itself (required)
├── references/         ← Supporting documentation (optional)
│   └── *.md
└── evals/              ← Eval cases for quality measurement (optional)
    └── evals.json
```

### SKILL.md structure

Every skill opens with YAML front matter carrying `name` and `description` — both are required and the setup validator fails without them:

```markdown
---
name: <skill-name>
description: <what it does, and the exact phrasing that should trigger it>
---

# <Skill Name>

## When to use this skill
<1–2 sentences describing the exact scenario that triggers this skill>

## Prerequisites
<What must be true before starting — e.g. backend compiled, feature folder exists>

## Steps
### Step 1 — <description>
<Detailed guidance, code templates, and examples>

### Step 2 — <description>
...

## Completion checklist
- [ ] ...
```

Keep `SKILL.md` short enough to read in one pass — roughly 200 lines. Depth belongs in `references/`, which the skill reads only when it needs those details.

---

## Skill inventory

Generated from `.ai/skills/` on disk. Every folder there appears exactly once below.

### Getting started and operating

| Skill | When to invoke |
|---|---|
| `getting-started` | Going from nothing to a running Cratis application — templates, `dotnet new`, Chronicle, MongoDB, the first run |
| `running-and-debugging` | Inspecting or repairing a **running** Chronicle store with the `cratis` CLI — observers, failed partitions, replay |
| `diagnose-slice` | A slice misbehaves and the cause is not obvious — symptom → likely cause → the rule or skill that owns the fix |
| `observable-query-curl` | Debugging an observable query from a terminal with cURL — snapshots, SSE, long polling |

### Modeling

| Skill | When to invoke |
|---|---|
| `event-modeling` | Deciding stream boundaries, commands, events, read models, and the spec outline **before** writing code |
| `create-event-model` | Creating or updating the Mermaid `EventModel.md` diagram for a module or feature |
| `add-concept` | Adding a `ConceptAs<T>` strongly-typed domain value or identifier |

### Building a slice

| Skill | When to invoke |
|---|---|
| `new-vertical-slice` | Building a complete slice end-to-end — backend → build → specs → frontend → quality gates |
| `cratis-vertical-slice` | Understanding how vertical slice architecture works before building one |
| `scaffold-feature` | Creating a new feature folder with composition page, routing, and navigation entry |
| `cratis-command` | Creating a command with `Handle()`, a validator, `CommandDialog`, and the React hook |
| `cratis-readmodel` | Creating a read model from scratch — events, projection or reducer, query, TypeScript proxy |
| `add-projection` | Adding a Chronicle projection to an existing read model |
| `add-reducer` | A read model genuinely needs `IReducerFor<T>` because projections cannot express the transition |
| `add-reactor` | Adding a Chronicle reactor — an automation or a translation |
| `add-business-rule` | Adding a validation rule, business rule, or uniqueness constraint to a command |
| `call-command-from-code` | Running a command from backend code through `ICommandPipeline` instead of over HTTP |
| `query-paging` | Adding server-side paging and sorting to a read-model query |
| `discover-implementations` | Enumerating every implementation of an interface with `IInstancesOf<T>` instead of hand-registered DI |
| `cross-cutting-properties` | Attaching audit or correlation metadata to every appended event without polluting event types |
| `event-type-migrations` | Evolving an event schema without breaking replay — a new generation plus an `EventTypeMigration` |
| `multi-tenancy` | Isolating tenants with Chronicle namespaces |
| `add-ef-migration` | Adding a hand-written EF Core migration |
| `auth-and-identity` | Authentication, authorization, or identity in a Cratis Arc project — backend, frontend, or both |
| `add-traces` | Adding OpenTelemetry tracing to a Chronicle Kernel class with the `[Span]` source generator |

### Frontend

| Skill | When to invoke |
|---|---|
| `cratis-react-page` | Building a React page with `DataPage`, `CommandDialog`, row selection, and observable queries |
| `stepper-command-dialog` | Building a multi-step wizard dialog with `StepperCommandDialog` |
| `toolbar` | Building a canvas-style icon toolbar with the `@cratis/components` `Toolbar` component |

### Specs

| Skill | When to invoke |
|---|---|
| `write-specs` | Specs for an application slice using the in-process scenario family |
| `write-specs-events` | Specs for event appending, constraints, and concurrency with `EventScenario` |
| `write-specs-readmodels` | Specs for projections and reducers with `ReadModelScenario<T>` |
| `write-specs-frontend` | Specs for the React and TypeScript surface of a slice |
| `cratis-specs-csharp` | C# BDD spec patterns — `Establish`/`Because`/`should_`, the `for_`/`when_` hierarchy, NSubstitute |
| `cratis-specs-typescript` | TypeScript BDD spec patterns — `given()`/`describe`/`it`, Sinon, Chai |

### Standards and review

| Skill | When to invoke |
|---|---|
| `cratis-csharp-standards` | Reference for C# conventions — formatting, naming, records, nullable handling, DI |
| `review-code` | Structured code review against all architecture and style standards |
| `review-performance` | Performance audit — Chronicle projections, MongoDB queries, allocations, React overhead |
| `review-security` | Security audit — injection, auth/authz, data exposure, event-sourcing vulnerabilities |

### Documentation

| Skill | When to invoke |
|---|---|
| `write-documentation` | Classifying a page under Diátaxis and drafting it in that style |
| `add-cratis-docs-page` | Creating a **new** docs page — where it goes, sidebar wiring, verifying it renders |
| `edit-cratis-docs` | Changing an existing docs page across the split-repo documentation sources |
| `qa-cratis-docs` | Visually QA-ing rendered docs pages in light and dark, and diagnosing layout shift |

### Shipping and meta

| Skill | When to invoke |
|---|---|
| `ship-changes` | Branch, commit, push, open the PR, label it, merge, and clean up |
| `skill-creator` | Creating a new skill, improving an existing one, or running skill evals |
| `cratis-software-factory` | Planning or operating governed, typed, evidence-gated Cratis agent workflows |

---

## Skill references

Many skills carry a `references/` subfolder with supporting documentation. These are NOT loaded automatically — a skill reads them explicitly when it needs specific API details, which is what keeps `SKILL.md` short.

Skills with references today: `add-projection`, `auth-and-identity`, `cratis-command`, `cratis-csharp-standards`, `cratis-react-page`, `cratis-readmodel`, `cratis-software-factory`, `cratis-specs-csharp`, `cratis-specs-typescript`, `cratis-vertical-slice`, `getting-started`, `new-vertical-slice`, `review-code`, `running-and-debugging`, `skill-creator`, `write-specs`.

Skills with `evals/`: `add-business-rule`, `add-projection`, `add-reactor`, `cratis-command`, `cratis-csharp-standards`, `cratis-react-page`, `cratis-readmodel`, `cratis-software-factory`, `cratis-specs-csharp`, `cratis-specs-typescript`, `cratis-vertical-slice`, `new-vertical-slice`, `ship-changes`, `write-specs`.

---

## Adding a new skill

1. Create a folder under **`.ai/skills/<skill-name>/`** — never under `.github/`, `.claude/`, or `.agents/`.
2. Create `SKILL.md` with `name` and `description` front matter, following the structure above.
3. Add supporting material to `references/` if the skill needs depth beyond one readable page.
4. Add evals to `evals/evals.json` if you want quality measurement.
5. Add the skill to the inventory table in this file.
6. If a prompt should trigger the skill, create `.ai/prompts/<skill-name>.prompt.md` **and** its Claude command adapter `.claude/commands/<skill-name>.md`. Skills themselves need no per-skill adapter — the tool folders are symlinks to `.ai/skills`.
7. Run `.ai/hooks/scripts/validate-ai-setup.sh` and fix anything it reports.
8. Use the `skill-creator` skill for guided skill creation, improvement, and eval running.

---

## Relationship to instructions

Skills complement instructions — they do not duplicate them.

- An **instruction** says: "Commands define `Handle()` directly on the record."
- A **skill** says: "Here are the exact steps, code templates, and checklist for creating a new command from scratch."

If you find yourself adding long how-to sections with multi-step code templates to an instruction file, extract them into a skill and leave a reference in the instruction. See [Instructions vs Skills](./instructions-vs-skills.md) for more.

Where a skill and a rule conflict, treat it as drift: follow the stricter invariant and fix the stale artifact.
