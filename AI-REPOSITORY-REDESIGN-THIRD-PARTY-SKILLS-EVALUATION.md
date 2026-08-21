# Third-Party Skills Evaluation for Cratis AI

**Prepared:** 2026-08-20
**Status:** Canonical upstream-companion and clean-room adaptation decision
**Policy:** Cratis is not a third-party skills redistributor

## 1. Audited sources

### Matt Pocock skills

- repository: <https://github.com/mattpocock/skills>;
- audited commit: `0ab1b63a410a03d3627979a109c8695de27af954`;
- package/plugin version: `1.2.3`;
- promoted inventory: 18 engineering plus seven productivity skills;
- invocation: 14 user-only and 11 model-reachable promoted skills;
- license: MIT, copyright 2026 Matt Pocock.

### pstack

- repository: <https://github.com/cursor/plugins/tree/main/pstack>;
- audited monorepo commit: `51a96e0dd838404da19ba83dc70aa21eef71f868`;
- plugin version: `0.14.1`;
- inventory: 44 skills, two agents, 22 selectable playbooks plus shared PR flow, executable scripts, references, guide/assets, and dormant Benny automation;
- license: MIT, copyright 2026 Lauren Tan.

The audits read all promoted Matt skills and all 156 files under pstack. No external or Cratis source was modified.

## 2. Executive decision

Do not vendor, fork, mirror, bundle, transitively install, or redistribute either collection through Cratis.

Use three dispositions:

1. **Optional upstream companion.** A user may install an upstream product directly from its owner, under its own support/update/trust model.
2. **Independent Cratis adaptation.** Reimplement selected requirement-level ideas in Cratis terminology, structure, examples, ownership, and evaluation fixtures.
3. **Actual-owner assignment.** Route governed workflows to Ensemble, durable execution to Stagehand, release mechanics to Workflows, Chronicle tools to Chronicle.Mcp, current product facts to product repositories, and project facts to consuming repositories.

No external skill body, script, agent, image, template, or branded persona enters the generated public Cratis artifact.

## 3. Why MIT is not enough

MIT permits use, modification, and redistribution when its notice is retained. It does not solve:

- product identity and implied endorsement;
- copyright in exact prompts, templates, examples, scripts, images, and arrangements;
- upstream maintenance and vulnerability ownership;
- host-specific behavior;
- project/context mutation;
- trigger and name collisions;
- executable trust;
- release reproducibility;
- conflict with Cratis authority boundaries.

Direct upstream installation keeps authorship, license, update, and support with the upstream owner. This is engineering provenance guidance, not legal advice.

## 4. Strong lessons from Matt Pocock’s collection

### Invocation is architecture

The user-only versus model-reachable distinction should become canonical Cratis target metadata and generate host-specific controls.

### Thin composition

Small journey wrappers compose focused capabilities instead of copying procedures. Cratis should compose by semantic capability ID, not by foreign slash-command names or assumptions about a universal Skill tool.

### Hard and soft dependencies

A hard dependency fails closed when absent. A soft dependency improves output but permits disclosed degradation. Add dependency strength and missing-dependency behavior to catalog v2.

### Human documentation differs from runbooks

Generate a human catalog page for each public capability: what, when, near misses, prerequisites, examples, signs of success, related capabilities, supported products/languages/hosts, and trust. Do not duplicate `SKILL.md` steps.

### Progressive disclosure and checkable completion

Keep operational skill bodies focused. Put branch-specific detail in references. Give every step an observable completion condition.

### Evidence-first diagnosis

Independently adapt exact symptom capture, tight reproduction, falsifiable hypotheses, targeted instrumentation, redaction, regression evidence, and cleanup into Cratis diagnostics.

### Independent review axes

Report specification/request compliance separately from repository/architecture standards, then preserve security, performance, verification, and public-contract lanes.

### Domain-language stress testing

Improve event modeling with precise terminology, concrete edge cases, code/model comparison, asynchronous questionnaires, and sparing durable decision records.

## 5. Matt skill dispositions

### Optional direct upstream companions

Potentially useful when deliberately installed by an individual:

- `grill-me` plus `grilling`;
- `handoff`;
- `to-questionnaire`;
- `wait-what`;
- `teach` in a dedicated learning workspace.

Do not recommend the complete plugin as a default Cratis environment. Its official Claude installation promotes all 25 skills, while selective installers copy files and have a separate mutable installer/update chain.

### Clean-room Cratis adaptations

- evidence-first diagnosis into application/slice diagnostics;
- tracer-bullet sizing and explicit dependency edges into planning;
- separate review lanes into `cratis-code-review`;
- terminology/scenario discipline into event modeling;
- invocation and dependency metadata into the catalog;
- progressive disclosure/completion checks into skill authoring;
- plain-language/questionnaire behavior into non-developer workflows.

### Engineering or another owner

- generic architecture survey: engineering package;
- tracker triage/spec/ticket graph: project plus Ensemble where governed;
- large decision maps/evidence: Ensemble;
- merge/commit/shipping: repository policy and Workflows;
- credential wizard: separately reviewed executable package only.

### Reject as shipped

- whole plugin;
- `setup-matt-pocock-skills`;
- `implement`;
- `resolving-merge-conflicts`;
- unbounded generic `research`;
- regex Git guardrails;
- manifest-changing miscellaneous skills;
- passive `wizard` distribution;
- upstream auto-update as part of an immutable Cratis release.

Important defects include automatic commits, “never abort” merge behavior, broad repository configuration writes, recursive-agent risks, review ordering that can omit working-tree changes, and executable secret-handling templates.

## 6. Strong lessons from pstack

### Real-artifact proof

Verify the user-visible artifact, command, UI, generated proxy, projected state, or digest. Compilation and agent summaries are not proof.

### Evidence confidence

Use direct, supported, inferred, speculative, and unknown claim classes. Null searches can be evidence. Model agreement is a signal, not proof.

### Lead judgment

Independent reviewers receive the same intent/evidence. A lead classifies findings as act on, consider, noted, or dismissed and rechecks them against context.

### Visible workflow outcomes

Represent completed, skipped-with-reason, blocked, failed, and inconclusive explicitly.

### Project-owned verification contract

A useful application verification model contains launch, doctor, drive, evidence, cleanup, and a user-facing feature map. Concrete commands, ports, selectors, credentials, fixtures, and feature maps remain project-owned.

### Fail-closed automation requirements

Valuable requirements include immutable source identity, one external writer, least-privilege workers, deduplication, ownership gates, existing-fix verification, compensation, atomic writes, stale-lock handling, untrusted-input treatment, and evidence tied to immutable heads.

These requirements belong to Ensemble, Stagehand, Workflows, or project automation rather than AI.

## 7. pstack dispositions

### Optional upstream companion

Allow an individual Cursor user to install pstack directly if they knowingly accept:

- all 44 skills and two agents;
- global Cursor model configuration;
- transcript access;
- Bun dependencies;
- GitHub and Graphite assumptions;
- external writes, PR/merge behavior, and cleanup capabilities;
- companion `cursor-team-kit` dependencies.

Use user scope, test in a disposable repository, keep Benny disabled, and treat shipping/cleanup/transcript/autopilot operations as high trust.

### Clean-room pstack-inspired Cratis adaptations

- real-artifact evidence contracts;
- explicit inconclusive results;
- independent validation for high-risk changes;
- project-owned verification contract;
- trigger/near-miss collision suites;
- read-only Chronicle diagnosis separated from mutating recovery;
- visible skipped/blocked steps;
- fail-closed automation requirements for the products that own automation.

### Assign to another owner

- multi-model panels, workflow profiles, verdict/evidence: Ensemble;
- durable stores/workers/retries/callbacks: Stagehand;
- PR queues/release/canary/rollback: Workflows;
- Chronicle operations: Chronicle.Mcp;
- concrete verification details: consuming project;
- current API/examples: owning product repository.

### Reject

- `poteto-mode` and `poteto-agent`;
- Comment Sicko and `/no-comments`;
- `setup-pstack`;
- universal `unslop`;
- transcript-derived personal mode and recall;
- worktree/simulator cleanup;
- Graphite shipping/autopilot;
- pstack orchestration runtime;
- Benny copying;
- generic TypeScript policy in public Cratis;
- hard dependencies on pstack capability names.

## 8. Cratis collisions

High-risk semantic collisions include:

- generic TDD versus Cratis BDD/scenario specifications;
- generic domain modeling versus Cratis event modeling;
- generic diagnosis versus slice diagnosis and live Chronicle inspection;
- generic review versus Cratis code/security/performance review;
- architecture/multi-agent panels versus planners and Ensemble;
- generic TypeScript policy versus Cratis TypeScript/product rules;
- setup skills versus `.cratis/PROJECT.md` and project bootstraps;
- shipping/merge flows versus `ship-changes` and Workflows;
- transcript/evidence modes versus Ensemble policy;
- generic Chronicle operations versus Chronicle.Mcp.

Keep semantic `cratis-*` names. Public Cratis capabilities must remain complete without an upstream companion and must never call one by name.

## 9. Portability and Pi

### Matt

Individual Markdown skills may be readable across hosts, but composition assumes host-specific invocation semantics. The root repository has a conventional recursive `skills/` tree containing promoted, miscellaneous, in-progress, and deprecated buckets and has no Pi-specific positive allowlist. Do not install the repository wholesale as a Pi package.

### pstack portability

The full product depends on Cursor Task schemas, model slugs, cloud workers, sticky mode metadata, todo lists, transcripts, `.cursor` configuration, `/loop`, built-ins, `cursor-team-kit`, Bun, Graphite, and scripts. Porting it to Pi would recreate a workflow/control-plane product and cross Ensemble, Stagehand, Workflows, and `@cratis/pi` boundaries.

### Cratis Pi treatment

`@cratis/ai` remains passive. `@cratis/pi` contains only genuine, independently reviewed Pi-native Cratis value. It does not wrap or redistribute either upstream system.

## 10. Companion registry and interoperability

Maintain repository-only metadata:

- upstream URL;
- immutable revision/version;
- license and owner;
- supported hosts;
- direct upstream installation route;
- trust/executable classification;
- project-file writes;
- external dependencies;
- known collisions;
- tested Cratis version;
- review/expiry date;
- `bytesIncluded: false`.

Interoperability rules:

- upstream systems are optional;
- Cratis product behavior wins for Cratis-specific requests;
- project policy and facts outrank every shared package;
- `ship-changes` wins for Cratis Git/PR/release work;
- Chronicle.Mcp owns Chronicle execution;
- third-party tools may produce artifacts that Cratis consumes as untrusted evidence;
- no combined installer, mirror, proxy package, or synchronized copy;
- no third-party tool may overwrite `.cratis/PROJECT.md` or its bootstraps.

## 11. Clean-room adaptation policy

1. Freeze source URL, revision, license, and reviewed paths.
2. Convert observations into requirement-level notes without preserving wording, headings, examples, templates, persona, or sequence.
3. Draft from Cratis values and authoritative product sources.
4. Use Cratis names, artifacts, and examples.
5. Run phrase and structural-similarity review.
6. If substantial similarity remains, redesign or classify it as derivative.
7. Add trigger, near-miss, behavior, security, ownership, and portability evaluations.
8. Record internal conceptual provenance.
9. If substantial expression/code is intentionally retained, preserve the relevant MIT notice and add third-party notices in every generated artifact.

Do not copy exact skill text, descriptions, playbooks, prompts, rubrics, templates, diagrams, images, agents/personas, scripts, model-role maps, or automation contracts.

## 12. Pilot plan

### Baseline

Record exact upstream revisions and current Cratis trigger behavior. Confirm owner assignments. Add no external bytes.

### Mixed-install tests

Use disposable repositories and test:

- Cratis alone;
- selected Matt skills alone;
- Cratis plus selected Matt skills;
- pstack alone in Cursor;
- Cratis plus pstack in Cursor.

Representative prompts include Arc-only commands, Chronicle language clients, stale read models, framework contribution, domain-expert modeling, code review, shipping, merge conflict, subsystem explanation, TypeScript work, and read-only Chronicle investigation.

Measure routing, duplicate triggers, wrong product/language, unexpected writes, recursion/fan-out, context cost, gate compliance, and user correction effort. Unsafe mutation, secret leakage, or project-context overwrite has zero tolerance.

### Clean-room Cratis pilots

Prioritize:

1. evidence-first slice diagnostics;
2. multi-lane code review;
3. domain-expert event modeling;
4. improved skill-authoring contract.

Promote only when blind comparisons beat the current baseline and ownership remains correct.

## 13. Final recommendation

These repositories are excellent research inputs and optional upstream products. Their principal value is the demonstrated craft:

- invocation is an architectural decision;
- narrow capabilities compose better than duplicated workflows;
- human navigation is a separate product surface;
- evidence must refer to real artifacts;
- generic engineering and product-specific expertise must not be conflated;
- autonomous work needs authority and durable evidence;
- skills must state when to run and when not to run;
- strong language comes from precise constraints and stable vocabulary, not imitation of another author’s voice.

Use them upstream. Learn from them. Independently implement selected Cratis-specific improvements. Do not redistribute them.
