# Cratis Software Factory

## Decision

Cratis should invest in a governed software factory and make `Cratis/AI` its
home. The factory should compose upstream Pi rather than fork it, preserve the
existing `cratis` CLI as a deterministic capability provider, and use Planner as
the durable managed control plane.

The managed runtime is **planned and on implementation hold**. The current
Python Stage 0 implementation is a temporary maintainer oracle, not the public
product runtime or production authority. The supported target uses native .NET
for deterministic authority, evaluation, CLI, and the trusted worker host;
TypeScript exists only in the thin Pi SDK adapter and Planner's React UI.

The product is not “a custom Pi.” Its durable advantage is the closed Cratis
loop:

```text
intent and collaborative modeling
    → Screenplay proposal and compiler diagnostics
    → deterministic Stage rendering
    → bounded agent implementation
    → Arc/Chronicle analyzers and specifications
    → runtime evidence and visual review
    → accepted model, code, and outcome feedback
```

Pi is a replaceable execution engine inside one agent phase. Server-side
`Planner.Factory` and its trusted authority own workflow state, sequencing,
retries, secret-reference resolution, exact input materialization,
sanitization, capability brokering, gates, approvals, commits, publishing, and
operations. The worker and Pi adapter never acquire that authority.

## Product surfaces

There are three deliberately separate surfaces:

<!-- markdownlint-disable MD013 -->

| Surface          | Responsibility                                                                                | Owner          | Status                       |
| ---------------- | --------------------------------------------------------------------------------------------- | -------------- | ---------------------------- |
| `cratis`         | Stable framework/runtime commands and machine-readable capability discovery                   | CLI repository | Existing                     |
| `cratis-factory` | Native .NET human and headless deterministic Factory experience                               | AI repository  | Planned, P0                  |
| Planner Factory  | Managed scheduling, trusted authority, approvals, durable run state, evidence, and publishing | AI repository  | Planned, implementation hold |

<!-- markdownlint-enable MD013 -->

The native .NET `cratis-factory` executable will expose deterministic human and
machine operations through `Factory.Core`; those operations require no Pi,
provider login, Node runtime, GitHub CLI, or existing `cratis` CLI. A future
agent-backed command can enter the managed authority boundary, but cannot embed
Pi or provider/session authority in the CLI. A later `cratis factory` command
may be a tiny forwarding shim, but the existing CLI must never acquire Factory,
Pi, provider, session, or run-state dependencies.

## Board evaluation

The review board reached the following decisions:

- The CTO supports the investment because Cratis already has a semantic
  language, compiler, renderer, runtime introspection, and collaborative
  model—not merely prompts.
- Engineering approves a staged program with one golden stack and measurable
  stop/go gates, not simultaneous support for every client and frontend.
- Product wants Studio to become the differentiated intent, proposal, and review
  experience after the worker proves credible.
- Security approves proposal and pull-request workflows only when they run in
  isolated workspaces with capability-scoped credentials and minimized evidence.
- Developer experience requires one-command onboarding, automatic profile
  detection, progressive knowledge loading, and no copied runtime in application
  repositories.
- Open-source maintenance rejects an early Pi fork and requires exact pins, an
  upstream-first policy, compatibility tests, provenance, and license
  attribution for reused code.

The unanimous choices are: compose around Pi, put ownership in AI, keep the
existing CLI clean, protect the acceptance machinery from the agents it
evaluates, and expand only when evaluation gates are met.

## What to adopt from Super Simple Software Factory

The
[Super Simple Software Factory](https://github.com/disler/super-simple-software-factory)
contributes a strong governing principle: agent proposes; code disposes.

Adopt:

- Explicit human, agent, and code phases.
- Code-owned sequencing, retries, acceptance, and known commands.
- Typed envelopes between phases.
- Separate phase completion and run acceptance.
- Same-session bounded correction for invalid output and repairable gate
  failures.
- Named roles independent from provider/model selection.
- Observable phase, tool, gate, cost, and artifact evidence.

Reject or replace:

- Stamping a Python runtime into every application repository.
- Running on the developer's current branch.
- Treating a post-hoc Git rollback as a security boundary.
- Inheriting the operator's entire environment.
- Allowing agents to commit, push, merge, deploy, or operate production
  directly.
- Placeholder commands that manufacture green results.
- Unredacted raw output in an unversioned local database.
- Parallel hand-maintained output definitions in prompts, types, and call sites.

The reference implementation is intentionally simple and explicitly lacks
sandboxing, per-run branches, merge handling, and human approvals. Its concepts
are useful; its limitations are not a production foundation.

## Repository ownership

```text
AI/
├── .ai/                         harness-neutral Cratis knowledge
├── Contracts/v1/                canonical JSON Schema protocol
├── Workflows/                   immutable workflow definitions
├── Factory/
│   ├── Capabilities/            trusted deterministic capability identities
│   ├── Fixtures/                executable compiler and ecosystem cases
│   ├── Profiles/                version-aware capability composition
│   ├── Policies/                risk and approval rules
│   └── scripts/                 temporary Python Stage 0 oracle
├── Source/
│   ├── Factory.Core/            PARTIAL accepted canonical and schema authority
│   ├── Factory.Evaluations/     PLANNED native .NET evaluation engine
│   ├── Factory.Cli/             PLANNED native .NET cratis-factory
│   ├── Factory.Worker/          HOLD .NET protocol, budget, and event host
│   ├── Factory.Worker.Pi/       HOLD thin TypeScript Pi SDK adapter
│   └── Planner/Factory/         HOLD C#/Chronicle graph and trusted authority
├── Evaluations/Factory/         golden tasks, fixtures, and baselines
└── Documentation/Factory/       product and operational design
```

The server-side trusted authority under `Source/Planner/Factory` owns secret
reference resolution, materialization, sanitization, capability brokering, and
publishing. `Source/Factory.Worker` is an authenticated broker client and owns
only the phase protocol, budgets, cancellation, and normalized events.
`Source/Factory.Worker.Pi` is the only TypeScript worker project and remains a
thin, exact-pinned adapter without independent authority.

Application repositories receive only a small committed `.cratis/factory.json`
manifest and project-specific knowledge. They do not receive a copied factory
runtime. Local runtime state stays outside source control; managed durable facts
live in Chronicle, while large sanitized artifacts use bounded-retention object
storage.

## Foundation delivered here

The initial repository foundation includes:

- Harness request, typed event, phase result, gate report, investigation result,
  workflow, compiled-workflow, profile, policy, and project-manifest schemas.
- Composable application and framework profiles for Arc, Components, Chronicle,
  and the verified .NET, TypeScript, Kotlin/Java, and Elixir clients.
- A deny-by-default local-development policy that protects factory definitions
  and forbids autonomous CLI context/model/update/init changes.
- A read-only issue-investigation workflow with typed output, evidence
  validation, cleanliness gates, and human acceptance.
- A 40-case foundation evaluation catalog spanning Cratis applications,
  modeling, operations, framework work, real clients, security, and reliability;
  ten discovery/preflight cases run now against nine immutable fixtures.
- A Draft 2020-12 validator, deterministic workflow compiler, ecosystem
  resolver, canonical hashing implementation, deterministic evaluation runner,
  executable fixtures, and focused adversarial tests.

This is the Stage 0 constitution and first safe workflow definition. Its Python
implementation is a temporary executable specification and differential-parity
oracle for maintainers. It is intentionally not a pretend Pi integration or a
supported public CLI: no provider or managed-runtime dependency is added until
the native .NET, authority, isolation, and evaluation seams are accepted.

## Further reading

- [Architecture](./architecture.md)
- [Contracts and human/machine interfaces](./contracts-and-interfaces.md)
- [Ecosystem intelligence](./ecosystem-intelligence.md)
- [Deterministic evaluations](./evaluations.md)
- [Enforcement matrix](./enforcement-matrix.md)
- [Experience principles and acceptance gates](./experience-principles.md)
- [CLI boundary](./cli-boundary.md)
- [Native schema validation contract](../../Factory/SchemaValidation.md)
- [Security and privacy](./security-and-privacy.md)
- [Roadmap and investment gates](./roadmap.md)
