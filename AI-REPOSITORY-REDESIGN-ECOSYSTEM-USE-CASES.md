# Cratis AI Ecosystem Use Cases and Product Coverage

**Prepared:** 2026-08-20
**Status:** Canonical product-coverage input
**Purpose:** Prevent the Cratis AI product from collapsing into a C#/Arc/Chronicle application-only toolset

## 1. Verdict

The distribution architecture remains sound, but the current candidate inventory is not a complete Cratis ecosystem product. It is strongest for C# applications that combine Arc, Chronicle, React, and Components.

The public capability model must support independent dimensions:

- product: Chronicle, Arc, Arc React, MVVM, Components, CLI, Screenplay, Stage, and public Studio workflows;
- language: language-neutral, C#, Kotlin, Java, Elixir, TypeScript, React, and shell/HTTP;
- architecture: Chronicle-only, Arc-only, Arc plus Chronicle, code-first, model-first, and mixed;
- persona: developer, contributor, maintainer, architect, product owner, QA, support, operator, and compliance;
- surface: backend, frontend, IDE, browser, CLI, CI, MCP, and generated artifact;
- trust: passive guidance, repository write, remote write, credential access, destructive operation, and executable package.

Do not make Arc implicit, do not make Chronicle synonymous with C#, and do not treat an IDE package as a Studio integration.

## 2. External application developers

### Chronicle-only .NET

Representative journeys:

- connect from ASP.NET Core, a worker, or a console application without Arc;
- define event types and append immutable facts;
- choose projections, reducers, reactors, and observers;
- define append-time constraints;
- evolve stored events through generations and migrations;
- model compliance subjects, metadata, correlation, and causation;
- isolate tenants through namespaces;
- test replay and sequence behavior;
- diagnose observers, failed partitions, and stale read models.

Required capability family: `cratis-chronicle-dotnet-*`.

### Chronicle Kotlin

Representative journeys:

- define annotated Kotlin data classes;
- use suspending APIs and coroutine-safe lifecycle behavior;
- use automatic classpath discovery;
- configure the Spring Boot starter;
- implement reducers, projections, reactors, constraints, migrations, seeders, and webhooks;
- test reconnect and registration behavior.

Required capability family: `cratis-chronicle-kotlin-*`.

### Chronicle Java

Representative journeys:

- define events as Java records or classes;
- use Java bridge APIs around Kotlin suspending surfaces;
- configure Maven or Gradle and Spring Boot;
- implement Java read models and reducers;
- test registration and projected state without Kotlin-only syntax.

Required capability family: `cratis-chronicle-java-*`. Kotlin and Java may share factual references but need independent triggers, examples, and tests.

### Chronicle Elixir

Representative journeys:

- supervise `Chronicle.Client` in an OTP tree;
- define event types, read models, projections, reactors, reducers, and seeders through Elixir macros;
- preserve process-scoped identity, correlation, and causation;
- use optimistic concurrency and transactions;
- recover after disconnects;
- inspect jobs and manage webhooks;
- test with Mix and ExUnit.

Required capability family: `cratis-chronicle-elixir-*`.

### Chronicle TypeScript

Representative journeys:

- configure decorator metadata;
- use `ChronicleClient`, event stores, event logs, and async disposal;
- define event types, read models, projections, reducers, reactors, constraints, migrations, and seeders;
- integrate with Node services without assuming React or Arc;
- diagnose gRPC and connection behavior.

Required capability family: `cratis-chronicle-typescript-*`. Trigger tests must distinguish the Chronicle TypeScript client from Arc-generated TypeScript proxies.

### Polyglot Chronicle

Representative journeys:

- share event semantics across C#, JVM, Elixir, and TypeScript services;
- keep event identifiers, generations, subjects, and metadata consistent;
- verify client-version compatibility;
- trace causation across language boundaries;
- preserve tenant and compliance meaning without mechanically translating APIs.

## 3. Arc application variants

### Arc-only backend

Arc does not require Chronicle. Representative journeys:

- commands that return `void`, a response, or work through injected services;
- model-bound queries over MongoDB, EF Core, or other stores;
- command validation, authorization, and `Provide()`;
- backend command execution through `ICommandPipeline`;
- generated TypeScript command/query proxies;
- EF Core migrations without event-sourcing assumptions.

Required families: commands, queries, validation, authorization, command execution, and EF integration.

### Arc plus React

Representative journeys:

- generated command and query proxies;
- command result and validation handling;
- observable queries;
- paging and sorting;
- loading, empty, error, and success states;
- generated-file diagnosis.

### Arc plus React MVVM

MVVM needs first-class coverage:

- observable state ownership;
- view-model initialization and disposal;
- command progress and error state;
- route/query parameter typing;
- observer boundaries;
- independent view-model specifications.

### Arc plus React plus Components

Representative journeys:

- command and stepper dialogs;
- forms and validation;
- `DataPage`, tables, selection, details, and paging;
- schema editors and toolbars;
- destructive confirmation;
- accessibility, keyboard behavior, and theme integration.

### Arc plus Chronicle combinations

Composition journeys must cover:

- Arc validation versus Chronicle append-time constraints;
- typed event-source identity;
- event-producing commands;
- projections/read models exposed through Arc queries;
- reactors executing Arc commands;
- observable projected state in React/MVVM;
- eventual projection visibility and duplicate-submit safety;
- Components dialogs and tables over event-sourced behavior.

Use tested journey composition rather than one duplicated mega-skill.

## 4. Modeling, Screenplay, Stage, and Studio

### Event modeling

Support domain experts and architects through:

- commands, facts, streams, state views, automations, and translations;
- concrete scenario stress tests;
- terminology and compliance-subject decisions;
- unresolved-question capture;
- plain-language summaries and Mermaid diagrams;
- handoff to Screenplay or code-based implementation.

### Screenplay

Support:

- `.play` concepts, slices, commands, events, queries, projections, screens, reactions, validation, and authorization;
- compiler diagnostic interpretation;
- VS Code language tooling;
- the browser/Monaco editor;
- embedded C#, TypeScript, React, HTML, PDL, and CDL;
- CI validation of Screenplay files.

Skills complement the Screenplay compiler and language service; they do not reproduce them.

### Stage

Support:

- running an authored model without code generation;
- inspecting the generated Arc/Chronicle HTTP and Workbench surfaces;
- executing modeled commands and queries;
- running Stage specifications and interpreting `results.json`;
- comparing a runtime prototype with a later code implementation.

### Studio

Public guidance may support:

- visual event-model preparation and review;
- terminology and scenario clarification;
- public onboarding;
- bug and feature-request preparation;
- browser/OS/version evidence and screenshot redaction;
- public relationships among Studio, Screenplay, Stage, and Chronicle.

Do not infer private Studio implementation, APIs, deployment, or source layout.

## 5. CLI, Workbench, operations, and MCP

### Cratis CLI

Cover:

- installation channels, contexts, event stores, and namespaces;
- event/event-type/schema inspection;
- observers, positions, and failed partitions;
- projection/read-model/job inspection;
- machine-readable output and CI exit codes;
- terminal Workbench;
- separately confirmed replay, retry, stop, resume, and deletion flows.

Split read-only diagnosis, automation, recovery, and administration.

### Browser Workbench

Provide browser-first guidance for events, observers, failed partitions, read models, projected state, evidence capture, and support escalation.

### Chronicle MCP

`Cratis/Chronicle.Mcp` owns executable Chronicle MCP tools, schemas, credentials, prompts, and mutations. AI may provide passive installation, selection, safety, and interpretation guidance. Pi may provide a separately reviewed adapter, but must not reimplement Chronicle tools.

## 6. Contributors and maintainers

### External contributors

They need repository-owned context for:

- repository mode and profile;
- exact toolchains and gates;
- generated-file behavior;
- framework/client API compatibility;
- language-native tests;
- product documentation ownership;
- safe PR preparation without publication authority.

Application vertical-slice conventions must not be applied to framework/client repositories.

### Cratis maintainers

Separately trusted engineering packages may provide:

- Cratis C#/TypeScript conventions;
- source-generator and analyzer workflows;
- Chronicle Kernel tracing;
- multi-repository documentation;
- security/performance review agents;
- release and shipping policy;
- Pi hooks and subagent extensions.

These do not enter the public product artifact.

### Cratis consultants in client repositories

Use three independently controlled layers:

1. public Cratis product guidance;
2. optional Cratis engineering guidance;
3. client-owned `.cratis/PROJECT.md` and project bootstraps.

Never let one client’s context, endpoints, credentials, or conventions leak into another engagement.

## 7. Non-developer and GUI-first users

### Product owners/domain experts

Use cases include glossary creation, lifecycle narratives, missing-fact analysis, stream-boundary comparison, PII classification, workshop notes, Screenplay drafts, and acceptance criteria.

### QA

Use cases include positive/negative scenarios, replay/concurrency cases, Stage specification runs, model-versus-runtime comparison, and regression evidence.

### Support

Use cases include Studio issue preparation, failed-observer summaries, redaction, reproduction timelines, product routing, and evidence collection.

### Operators/compliance

Use cases include browser/terminal Workbench, read-only MCP analysis, recovery proposals, audit narratives, causation tracing, and tenancy review.

### Interaction paths

- IDE GUI: Cursor Marketplace, VS Code Agent Plugins, Kiro Powers;
- browser assistant: ChatGPT/Codex directory after approval;
- product browser: Studio, Chronicle Web Workbench, Screenplay editor;
- terminal/TUI: Pi, Gemini CLI, Cratis CLI;
- managed organization: approved marketplace/package pins;
- no installation: generated browser-readable catalog, guides, and worksheets;
- CI: immutable package/archive and machine-readable validators.

## 8. Product architecture consequences

Public capabilities should be a language-neutral core plus product/language/persona/surface/trust overlays. Candidate generated profiles include:

- `cratis-core`;
- Chronicle .NET, Kotlin, Java, Elixir, and TypeScript;
- Arc backend, Arc React, Arc React MVVM, and Components;
- Arc plus Chronicle composition;
- modeling/Screenplay/Stage/public Studio;
- read-only operations and separately authorized administration;
- external contributor routing;
- internal engineering profiles.

Profiles are generated from one catalog. Agent Plugins has no portable dependency system, so skills must remain self-contained and generated bundles must avoid duplicate names.

## 9. Representative acceptance journeys

Before ecosystem-wide claims, pass at least:

1. Chronicle-only Kotlin or Java;
2. Chronicle-only Elixir or TypeScript;
3. Arc-only backend and React;
4. Arc plus Chronicle plus React plus MVVM plus Components;
5. browser-only Studio or Workbench;
6. Screenplay through Stage;
7. read-only triage followed by separately confirmed recovery;
8. Chronicle.Mcp causal analysis without mutation;
9. external framework/client contributor;
10. consultant switching safely between client projects;
11. Pi passive package versus executable extension;
12. GUI installation without a shell.

## 10. Official sources

- <https://github.com/Cratis/Chronicle>
- <https://github.com/Cratis/Arc>
- <https://github.com/Cratis/Components>
- <https://github.com/Cratis/Chronicle.Kotlin>
- <https://github.com/Cratis/Chronicle.Elixir>
- <https://github.com/Cratis/Chronicle.TypeScript>
- <https://github.com/Cratis/cli>
- <https://github.com/Cratis/Screenplay>
- <https://github.com/Cratis/Stage>
- <https://github.com/Cratis/StudioIssues>
- <https://github.com/Cratis/Chronicle.Mcp>
