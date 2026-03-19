# Skills

Skills are **detailed, step-by-step implementation guides** invoked on demand when a developer needs to perform a specific, reusable workflow. They answer *how* to do something — the exact sequence of steps, patterns, and code templates required to complete a well-defined task.

See also: [Architecture Overview](./architecture.md) · [Instructions vs Skills](./instructions-vs-skills.md)

---

## How skills work

A skill lives in `.github/skills/<skill-name>/SKILL.md`. It is NOT loaded automatically — it is invoked explicitly when a user asks for that workflow or when an agent determines that skill is needed.

Each skill:
- Has a single, well-defined purpose
- Provides step-by-step guidance
- Includes code templates and examples
- May reference supporting material in a `references/` subfolder
- May include eval cases in an `evals/` subfolder for quality measurement

---

## Skill anatomy

```
.github/skills/<skill-name>/
├── SKILL.md            ← The skill itself (required)
├── references/         ← Supporting documentation (optional)
│   └── *.md
└── evals/              ← Eval cases for quality measurement (optional)
    └── evals.json
```

### SKILL.md structure

A well-formed skill file follows this structure:

```markdown
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

---

## Skill inventory

### Implementation skills

| Skill | When to invoke |
|---|---|
| `cratis-command` | Creating a new command with `Handle()`, validator, `CommandDialog`, and React hook |
| `cratis-readmodel` | Creating a read model from scratch — events, projection, query, TypeScript proxy |
| `cratis-vertical-slice` | Understanding how vertical slice architecture works in this project |
| `new-vertical-slice` | Building a complete slice end-to-end (backend → specs → build → frontend) |
| `scaffold-feature` | Creating a new feature folder with composition page, routing, and nav entry |
| `add-concept` | Adding a `ConceptAs<T>` strongly-typed domain value |
| `add-projection` | Adding a Chronicle projection to an existing read model |
| `add-reactor` | Adding a Chronicle reactor (side-effect observer) |
| `add-business-rule` | Adding a validation rule, business rule, or uniqueness constraint to a command |
| `add-ef-migration` | Adding a hand-written EF Core migration (cross-database compatible) |
| `auth-and-identity` | Setting up authentication, authorization, or identity in a Cratis Arc project |
| `stepper-command-dialog` | Building a multi-step wizard dialog using `StepperCommandDialog` |

### Standards and review skills

| Skill | When to invoke |
|---|---|
| `cratis-csharp-standards` | Reference for C# coding conventions — formatting, naming, records, nullable handling |
| `cratis-react-page` | Building a React page with `DataPage`, `CommandDialog`, observable queries |
| `cratis-specs-csharp` | Writing C# BDD specs — `Establish`/`Because`/`should_` pattern, NSubstitute |
| `cratis-specs-typescript` | Writing TypeScript BDD specs — `given()`/`describe`/`it` pattern, Chai |
| `review-code` | Structured code review against all architecture and style standards |
| `review-performance` | Performance audit — Chronicle projections, MongoDB queries, React overhead |
| `review-security` | Security audit — injection, auth/authz, data exposure, event-sourcing vulnerabilities |

### Documentation skills

| Skill | When to invoke |
|---|---|
| `write-documentation` | Writing DocFX documentation following the Diátaxis framework |
| `write-specs` | Writing BDD integration specs for a command or vertical slice |

### Meta skills

| Skill | When to invoke |
|---|---|
| `skill-creator` | Creating a new skill, improving an existing skill, or running skill evals |

---

## Skill references

Many skills have a `references/` subfolder with supporting documentation pulled from Cratis Chronicle and Arc sources. These are NOT loaded automatically — a skill explicitly reads them during execution when it needs specific API details.

Examples:
- `add-projection/references/CHRONICLE-API.md` — Chronicle projection API reference
- `cratis-command/references/validation.md` — CommandValidator and FluentValidation patterns
- `auth-and-identity/references/authentication.md` — IProvideIdentityDetails implementation guide

---

## Adding a new skill

1. Create a folder under `.github/skills/<skill-name>/`.
2. Create `SKILL.md` following the structure above.
3. Add supporting material to `references/` if needed.
4. Add evals to `evals/evals.json` if you want quality measurement.
5. Add the skill to the inventory table in this file.
6. If a prompt should trigger this skill, create `.github/prompts/<skill-name>.prompt.md`.
7. Use the `skill-creator` skill for guided skill creation, improvement, and eval running.

---

## Relationship to instructions

Skills complement instructions — they do not duplicate them.

- An **instruction** says: "Commands define `Handle()` directly on the record."
- A **skill** says: "Here are the exact steps, code templates, and checklist for creating a new command from scratch."

If you find yourself adding long how-to sections with multi-step code templates to an instruction file, extract them into a skill and leave a reference in the instruction. See [Instructions vs Skills](./instructions-vs-skills.md) for more.
