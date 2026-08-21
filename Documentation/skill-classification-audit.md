# Current Skill Classification Audit

> **Reevaluated — 2026-08-20:** A complete second pass confirmed the 35 public-source and eight engineering-source classifications, the `add-business-rule` split, focused performance review, and the engineering ownership of `add-traces` and broad C# conventions. The vertical-slice merge remains an evaluation-gated experiment, not an approved merge. Current details and remediation are in [`../AI-REPOSITORY-REDESIGN-REEVALUATION.md`](../AI-REPOSITORY-REDESIGN-REEVALUATION.md#8-complete-43-skill-reevaluation).

**Audited:** 2026-08-20
**Inventory:** 43 current skills
**Audited baseline:** 37 public candidates and 6 internal skills
**Approved source classification:** 35 public candidates and 8 engineering skills

This is a read-only audit of the legacy `.ai/skills/` corpus against the public
product boundary. The maintainer decision recorded after the audit moves
`add-traces` and `cratis-csharp-standards` to engineering ownership. The
evidence below remains useful, but that decision supersedes conditional or
public classifications in the original assessment.

## Inventory result

All 43 direct skill directories contain `SKILL.md`, and every current
frontmatter `name` matches its directory. The handover accounts for all 43.

The eight engineering classifications are:

- `add-cratis-docs-page`;
- `edit-cratis-docs`;
- `qa-cratis-docs`;
- `write-documentation`;
- `ship-changes`;
- `skill-creator`;
- `add-traces`;
- `cratis-csharp-standards`.

The engineering source remains public under `engineering/`, but none of these
skills enters the public `@cratis/ai` or Agent Plugin artifact.

## Audit of all current skills

### Fundamentals, C#, and EF Core

1. **`add-concept` → `cratis-fundamentals-concept`** — Public and accurately
   named. It is self-contained and covers both `ConceptAs<T>` values and
   `EventSourceId<T>` identities. Evidence:
   `.ai/skills/add-concept/SKILL.md`.
2. **`discover-implementations` →
   `cratis-fundamentals-type-discovery`** — Public, focused, and self-contained
   around `IInstancesOf<T>` and `[Singleton]`. Evidence:
   `.ai/skills/discover-implementations/SKILL.md`.
3. **`cratis-csharp-standards` →
   `cratis-engineering-csharp-conventions`** — Engineering-owned. Broad house
   conventions are persistent engineering policy rather than an on-demand
   public product capability. Public skills should carry only the C# facts they
   require. Its evals remain engineering-only, and its event-type guidance
   still needs a migration exception. Evidence:
   `.ai/skills/cratis-csharp-standards/`.
4. **`add-ef-migration` → `cratis-ef-core-migration`** — Public and accurately
   named, but blocked by its dependency on `.ai/rules/efcore.md`. Evidence:
   `.ai/skills/add-ef-migration/SKILL.md`.

### Arc commands, rules, and identity

1. **`add-business-rule` → `cratis-arc-business-rule`** — Public, but the name
   understates Chronicle uniqueness and constraint behavior. It depends on the
   vertical-slice rule and contains colocated evals. Evidence:
   `.ai/skills/add-business-rule/`.
2. **`cratis-command` → `cratis-arc-command`** — Public and accurately named.
   It depends on the vertical-slice rule, uses legacy skill names, and contains
   colocated evals. Evidence: `.ai/skills/cratis-command/`.
3. **`call-command-from-code` → `cratis-arc-command-pipeline`** — Public and
   acceptably named. It must remove the unbundled vertical-slice dependency and
   update legacy cross-skill names. Evidence:
   `.ai/skills/call-command-from-code/SKILL.md`.
4. **`auth-and-identity` →
   `cratis-arc-authentication-and-identity`** — Public, but authorization must
   remain prominent in its description. It points to generated Copilot
   instructions and a repository-local frontend document. Its cookie and local
   role guidance needs focused security review. Evidence:
   `.ai/skills/auth-and-identity/`.
5. **`query-paging` → `cratis-arc-query-paging`** — Public and accurately named.
   It depends on vertical-slice and React rules. Its Arc-managed paging guidance
   conflicts with `review-performance`. Evidence:
   `.ai/skills/query-paging/SKILL.md`.
6. **`observable-query-curl` → `cratis-arc-observable-query-http`** — Public,
    focused, and self-contained. Localhost endpoints are examples rather than
    private infrastructure. Evidence:
    `.ai/skills/observable-query-curl/SKILL.md`.

### Chronicle modeling and event behavior

 1. **`event-modeling` → `cratis-chronicle-event-modeling`** — Public and
    accurately named. It depends on general and vertical-slice rules and has the
    clearest public-to-internal edge: it invokes `ship-changes`. Evidence:
    `.ai/skills/event-modeling/SKILL.md`.
 2. **`create-event-model` → `cratis-event-model-diagram`** — Public and well
    renamed. It is distinct from domain modeling, but depends on the
    vertical-slice rule and the legacy event-modeling name. Evidence:
    `.ai/skills/create-event-model/SKILL.md`.
 3. **`event-type-migrations` →
    `cratis-chronicle-event-type-migration`** — Public and accurately named. It
    depends on a legacy rule, and its valid `generation:` example conflicts
    with blanket no-argument event-type guidance elsewhere. Evidence:
    `.ai/skills/event-type-migrations/SKILL.md`.
 4. **`cross-cutting-properties` → `cratis-chronicle-event-metadata`** — Public
    and accurately named. Its payload distinction is sound, but it depends on
    the vertical-slice rule and legacy names. Evidence:
    `.ai/skills/cross-cutting-properties/SKILL.md`.
 5. **`multi-tenancy` → `cratis-chronicle-multi-tenancy`** — Public and
    accurately named. It correctly centers namespace isolation but references
    the reactor rule and legacy skill names. Evidence:
    `.ai/skills/multi-tenancy/SKILL.md`.

### Chronicle read models and reactions

 1. **`cratis-readmodel` → `cratis-chronicle-read-model`** — Public and
    accurately named. It contains evals and repository-local documentation
    links. Its reducer advice conflicts with `add-reducer`, and it incorrectly
    generalizes identities as `ConceptAs<T>`. Evidence:
    `.ai/skills/cratis-readmodel/`.
 2. **`add-projection` → `cratis-chronicle-projection`** — Public and accurately
    named. It contains evals and a repository-local filtering-document link.
    Its bundled Chronicle API reference is suitable for public migration.
    Evidence: `.ai/skills/add-projection/`.
 3. **`add-reducer` → `cratis-chronicle-reducer`** — Public and accurately
    named. It depends on scenario and vertical-slice rules. Preserve its
    projection-first, reducer-last admission test. Evidence:
    `.ai/skills/add-reducer/SKILL.md`.
 4. **`add-reactor` → `cratis-chronicle-reactor`** — Public and accurately
    named. It depends on the reactor rule, contains evals, and links to
    repository-local filtering documentation. Evidence:
    `.ai/skills/add-reactor/`.

### Chronicle contributor and operations skills

 1. **`add-traces` → `cratis-engineering-chronicle-kernel-tracing`** —
    Engineering-owned. It names transient kernel files, compatibility-shim
    cleanup, and package-version work, making it repository contributor
    guidance rather than a public product capability. Evidence:
    `.ai/skills/add-traces/SKILL.md`.
 2. **`inspect-running-chronicle` → `cratis-chronicle-operations`** — Public,
    but `cratis-chronicle-cli-operations` is a more precise alternative. It
    mixes read-only inspection with replay and recovery actions and contains
    legacy corpus setup. Security and destructive-operation evals are required.
    Evidence: `.ai/skills/inspect-running-chronicle/SKILL.md`.
 3. **`diagnose-slice` → `cratis-application-slice-diagnostics`** — Public and
    accurately named. It is primarily a router to legacy rules and current
    skill names, so it is not yet self-contained. Evidence:
    `.ai/skills/diagnose-slice/SKILL.md`.

### Application architecture

 1. **`cratis-vertical-slice` → `cratis-application-vertical-slice`** — Public
    and part of the proposed merge. Although its description sounds
    explanatory, its eval requests complete implementation and competes with
    `new-vertical-slice`. Evidence: `.ai/skills/cratis-vertical-slice/`.
 2. **`new-vertical-slice` → `cratis-application-vertical-slice`** — Public and
    part of the proposed merge. It contains evals, a hard-coded documentation
    gate, conflicting concept placement, and stale component patterns. Evidence:
    `.ai/skills/new-vertical-slice/`.
 3. **`scaffold-feature` → `cratis-application-feature-scaffolding`** — Public.
    The proposed name is usable, although the current payload is specifically a
    React route, navigation, and page shell. Its barrel guidance conflicts with
    the review checklist. Evidence: `.ai/skills/scaffold-feature/SKILL.md`.

### React and Components

 1. **`cratis-react-page` → `cratis-arc-react-page`** — Public and accurately
    named. It depends on dialog and React rules and contains evals. Bundled
    references and evals include APIs that conflict with the current skill.
    Evidence: `.ai/skills/cratis-react-page/`.
 2. **`stepper-command-dialog` →
    `cratis-components-stepper-command-dialog`** — Public, focused, and
    self-contained. Keep it separate from general page composition. Evidence:
    `.ai/skills/stepper-command-dialog/SKILL.md`.
 3. **`toolbar` → `cratis-components-toolbar`** — Public and accurately named.
    It correctly excludes normal page actions but delegates import policy to the
    unbundled Components rule. Evidence: `.ai/skills/toolbar/SKILL.md`.

### Specification skills

 1. **`cratis-specs-csharp` → `cratis-specifications-csharp`** — Public and
    acceptably named when narrowed to framework and library foundations. It
    depends on two rules, contains evals, and overlaps `write-specs`. Evidence:
    `.ai/skills/cratis-specs-csharp/`.
 2. **`cratis-specs-typescript` → `cratis-specifications-typescript`** — Public
    and acceptably named when explicitly framework or package scoped. Its
    bundled reference is portable, but evals must move. Evidence:
    `.ai/skills/cratis-specs-typescript/`.
 3. **`write-specs` → `cratis-application-specifications`** — Public, but
    `cratis-application-slice-specifications` is more precise. It is an
    application backend scenario router, depends on specification rules, and
    contains evals. Evidence: `.ai/skills/write-specs/`.
 4. **`write-specs-events` → `cratis-chronicle-event-specifications`** — Public
    and usable with a narrower description. It should own raw append,
    constraint, concurrency, and sequence behavior rather than command behavior.
    Evidence: `.ai/skills/write-specs-events/SKILL.md`.
 5. **`write-specs-readmodels` →
    `cratis-chronicle-read-model-specifications`** — Public, focused, and
    self-contained. Legacy public names still need updating. Evidence:
    `.ai/skills/write-specs-readmodels/SKILL.md`.
 6. **`write-specs-frontend` → `cratis-react-specifications`** — Public and
    acceptably named when explicitly application scoped. It depends on frontend
    testing and React rules. Evidence:
    `.ai/skills/write-specs-frontend/SKILL.md`.

### Review skills

 1. **`review-code` → `cratis-code-review`** — Public and acceptably named. Its
    bundled checklist is portable, but it duplicates substantial performance
    ownership and conflicts with feature-barrel scaffolding. Evidence:
    `.ai/skills/review-code/`.
 2. **`review-performance` → `cratis-performance-review`** — Public and
    accurately named, but behavior is blocked. Manual paging and validator I/O
    guidance conflicts with Arc paging and business-rule guidance. Evidence:
    `.ai/skills/review-performance/SKILL.md`.
 3. **`review-security` → `cratis-security-review`** — Public and accurately
    named, but behavior is blocked. Its event-source ID and cookie rules are too
    absolute for supported command and identity flows. Evidence:
    `.ai/skills/review-security/SKILL.md`.

### Internal engineering skills

 1. **`add-cratis-docs-page` → `cratis-engineering-docs-add-page`** — Internal.
    It assumes the Cratis multi-repository documentation build and navigation
    workflow. Evidence: `.ai/skills/add-cratis-docs-page/SKILL.md`.
 2. **`edit-cratis-docs` → `cratis-engineering-docs-edit-page`** — Internal. It
    assumes sibling repositories, generated copies, and internal site scripts.
    Evidence: `.ai/skills/edit-cratis-docs/SKILL.md`.
 3. **`qa-cratis-docs` → `cratis-engineering-docs-visual-qa`** — Internal. It
    requires internal screenshot scripts, Chrome/CDP, and generated site data.
    Evidence: `.ai/skills/qa-cratis-docs/SKILL.md`.
 4. **`write-documentation` → `cratis-engineering-docs-authoring`** — Internal.
    Reusable Diátaxis content is coupled to private ownership and site rules.
    Evidence: `.ai/skills/write-documentation/SKILL.md`.
 5. **`ship-changes` → `cratis-engineering-ship-changes`** — Internal. It
    encodes Cratis GitHub, issue, branch, label, release, and CI policy and has
    private evals. Evidence: `.ai/skills/ship-changes/`.
 6. **`skill-creator`** — Internal and should retain the upstream name. It is the
    only skill with scripts and includes agents, assets, viewer code,
    references, and its Apache-2.0 license. One script contains an absolute
    workstation path. Evidence: `.ai/skills/skill-creator/`.

## Migration blockers

### Legacy dependencies

Nineteen public candidates directly depend on legacy rules or generated
instructions:

- `add-business-rule`;
- `add-ef-migration`;
- `add-reactor`;
- `add-reducer`;
- `auth-and-identity`;
- `call-command-from-code`;
- `cratis-command`;
- `cratis-react-page`;
- `cratis-specs-csharp`;
- `create-event-model`;
- `cross-cutting-properties`;
- `diagnose-slice`;
- `event-modeling`;
- `event-type-migrations`;
- `multi-tenancy`;
- `query-paging`;
- `toolbar`;
- `write-specs`;
- `write-specs-frontend`.

Essential facts must move into `SKILL.md` or bundled `references/**`. Changing
those links to another repository path would not satisfy the public boundary.

### Colocated evals

Eleven public candidates contain forbidden colocated evals:

- `add-business-rule`;
- `add-projection`;
- `add-reactor`;
- `cratis-command`;
- `cratis-react-page`;
- `cratis-readmodel`;
- `cratis-specs-csharp`;
- `cratis-specs-typescript`;
- `cratis-vertical-slice`;
- `new-vertical-slice`;
- `write-specs`.

`cratis-csharp-standards` and `ship-changes` also have colocated evals, but both
stay with the engineering toolchain. Only 11 of 35 public candidates have
equivalent current eval definitions, leaving 24 without current trigger
coverage.

### Public-to-internal and local dependencies

- Remove `event-modeling` → `ship-changes`.
- Remove the `new-vertical-slice` hard-coded `Documentation/web` gate.
- Remove shared-corpus generation behavior from Chronicle operations.
- Replace project-local filtering and frontend documentation links.
- Keep transient Chronicle kernel maintenance details under engineering
  ownership.
- Update legacy skill names, references, eval names, and catalog entries as one
  atomic rename graph.

### Behavioral conflicts

The following conflicts require one authoritative answer before migration:

1. projection-first reducer admission versus ordinary reducer recommendations;
2. Arc-managed paging versus manual `.Skip()` and `.Take()`;
3. `EventSourceId<T>` identities versus `ConceptAs<T>` identity wording;
4. no event-type arguments versus valid migration `generation:` metadata;
5. injected validator checks versus an in-memory-only performance rule;
6. accepted command target IDs versus a server-generated-only security rule;
7. JavaScript-readable identity details versus cookie security wording;
8. one-export feature barrels versus the review checklist;
9. `CommandScenario` versus `EventScenario` ownership;
10. stale React page and vertical-slice component examples.

## Trigger-collision sets

The required evaluation matrix must cover:

- event modeling, event diagrams, vertical slices, and feature scaffolding;
- command creation, business rules, command execution, and authorization;
- read models, projections, reducers, and query paging;
- framework specifications, application scenarios, events, read models, and
  React specifications;
- general, performance, security, and C# convention reviews;
- React pages, stepper dialogs, toolbars, and feature shells;
- source diagnostics, live Chronicle operations, and observable-query HTTP.

## Merge recommendations

Proceed with a **gated** vertical-slice merge into
`cratis-application-vertical-slice`. Build one reconciled draft, then run
positive and negative architecture-versus-implementation trigger tests. Retain
two skills only if tests demonstrate a durable boundary. Do not concatenate the
current bodies or stale references.

Evaluate `review-performance` consolidation only after correcting its guidance
and establishing one canonical performance checklist. Keep a specialist skill
only if focused trigger tests show useful depth and reliable routing.

Keep these capabilities separate:

- event modeling and event-model diagram maintenance;
- read-model creation, projection wiring, reducers, and paging;
- framework and application specification families;
- command definition and backend command execution;
- source diagnostics, live-store operations, and HTTP troubleshooting;
- React pages, stepper dialogs, and toolbars.

For the engineering corpus, consider making documentation authoring a shared router
and reference set used by add and edit workflows. Keep visual QA separate
because it requires executable infrastructure.

## Rename and split decisions

The handover now records these target decisions:

- split `add-business-rule` into `cratis-arc-command-validation` and
  `cratis-chronicle-event-constraints`;
- use `cratis-arc-command-execution` for backend pipeline invocation;
- use `cratis-arc-ef-core-migration` for the EF workflow;
- use `cratis-chronicle-cli-operations` for live-store CLI work;
- use `cratis-arc-react-feature-scaffolding` for the React feature shell;
- use `cratis-application-slice-specifications` for application scenario
  routing;
- use `cratis-application-react-specifications` for frontend application specs;
- keep broad C# conventions and Chronicle kernel tracing under engineering
  ownership.

The vertical-slice merge remains gated by a reconciled draft and trigger
evaluations rather than being treated as a mechanical rename.
