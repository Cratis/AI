# Agents

Agents are **specialist AI personas** with defined roles, tools, and completion checklists. Each agent owns a specific type of work and delegates anything outside its scope.

See also: [Architecture Overview](./architecture.md) · [Instructions vs Skills](./instructions-vs-skills.md)

---

## Where agents live

Agent definitions are authored in **`.ai/agents/<name>.md`** — the single source of truth. Each assistant reaches them through an adapter: Claude Code reads the `.claude/agents` folder symlink, and GitHub Copilot reads per-file adapters at `.github/agents/<name>.agent.md`, because Copilot requires the `.agent.md` suffix. Never edit an adapter directly.

---

## Agent roster

Generated from `.ai/agents/` on disk.

| Agent | Role | When to use |
|---|---|---|
| `orchestrator` | Top-level team orchestrator — assembles the team, sequences work, enforces quality gates | Any goal spanning implementation + documentation + review, or multiple independent workstreams |
| `coordinator` | General-purpose coordinator — decomposes goals, assigns agents, tracks progress | Cross-cutting implementation work spanning multiple concerns or multiple slices |
| `planner` | Vertical slice planner — sequences and parallelizes slice implementation | Implementing one or more complete vertical slices end-to-end |
| `slice-implementer` | Implements one slice end-to-end by itself — backend artifacts in a single slice file, specs in `when_*/` folders, and the React surface | A new slice, or a non-trivial slice change that spans backend and frontend and does not need a whole team |
| `backend-developer` | C# slice files — commands, events, validators, projections, reactors | Writing backend code for a specific slice |
| `frontend-developer` | React/TypeScript — components, composition pages, routing | Writing frontend code for a specific slice |
| `spec-writer` | C# specs (the in-process scenario family) and TypeScript/React specs | Writing specs for a slice |
| `code-reviewer` | Architecture conformance, C# and TypeScript standards | Reviewing code before merge |
| `security-reviewer` | Injection, auth/authz, data exposure, event-sourcing vulnerabilities | Security audit before merge |
| `performance-reviewer` | Chronicle projections, MongoDB queries, .NET allocations, React overhead | Performance audit |
| `repository-investigator` | Read-only investigation of an application **or** framework repository, producing typed, evidence-backed findings — changes no source, invokes no mutating Chronicle operation, and assumes no application architecture | Answering a question about how a repository actually works, before deciding to change anything |
| `repository-investigation-reviewer` | Independent read-only review of a completed repository investigation — checks the evidence and the repository-mode reasoning | Gating an investigation's conclusions before they are acted on |

### Choosing between the slice agents

`slice-implementer` does the whole slice itself. `planner` splits a slice across `backend-developer`, `spec-writer`, and `frontend-developer` and sequences them. Prefer `slice-implementer` for a single, well-understood slice; prefer `planner` when several slices are in flight or the work needs to run in parallel.

### The investigation pair

`repository-investigator` and `repository-investigation-reviewer` are deliberately separate. The investigator gathers evidence; the reviewer independently checks it. Both are read-only, and both are **repository-mode aware** — they must not apply application-profile conventions (vertical slices, model-bound commands, read models) to a framework or client-library repository, where those conventions do not exist. See the framework profile guidance in `.ai/rules/framework.md`.

---

## The Orchestrator

The `orchestrator` agent is the **top-level team manager** — the entry point when multiple agents need to work together as a team. Use it when:

- The goal spans implementation **and** documentation **and** review
- Multiple independent workstreams need to run in parallel
- You're unsure which combination of agents is needed
- The work involves non-implementation concerns alongside implementation

The orchestrator:

1. Classifies every concern in the goal (implementation, docs, testing, review)
2. Maps each concern to the right agent or sub-orchestrator
3. Identifies cross-stream dependencies
4. Groups independent streams into parallel phases
5. Delegates in phase order and tracks overall progress
6. Enforces quality gates before declaring success

See [Using the Orchestrator](./orchestrator.md) for a full guide.

---

## The Coordinator

The `coordinator` agent is the **entry point for complex, multi-concern implementation work**. Use it when:

- The request spans both backend and frontend
- Multiple slices need to be implemented
- The work requires both implementation and review
- You're unsure which specialist to call first

The coordinator:

1. Classifies the work into task types
2. Identifies dependencies between tasks
3. Groups independent tasks into parallel phases
4. Assigns each task to the right specialist
5. Outputs a markdown checklist with phase structure

### When to use the Orchestrator vs the Coordinator vs the Planner

| Use `orchestrator` when… | Use `coordinator` when… | Use `planner` when… |
|---|---|---|
| Goal spans implementation + docs + review | Goal is implementation only | Goal is one or more vertical slices |
| Multiple independent workstreams | Work crosses multiple concerns | Clear feature and slice names known |
| Involves non-implementation tasks | Infrastructure + slice implementation | Slice type is known |
| Unsure what combination of agents is needed | Mix of C# and TypeScript with reviews | Full slice pipeline needed |

---

## Parallelization model

Agents can run in parallel within a phase when their tasks have no mutual dependencies. The coordinator and planner both enforce these sequencing rules:

```text
Phase 1: Backend (C#)  ──────────────────────┐
                                              ▼
Phase 2: dotnet build -c Debug ← synchronization point (generates TypeScript proxies)
                                              ▼
Phase 3: Frontend (TypeScript) ──┐   Specs ──┘  (these two can run in parallel)
                                              ▼
Phase 4: Quality Gates (code review + security review — both in parallel)
```

**Key rule:** Frontend and backend for the **same slice** can never run in parallel because the frontend imports TypeScript proxy files generated by a **Debug** build. Independent slices (no shared events) can have their backends run in parallel.

---

## Agent hand-off protocol

When an agent completes its work and needs to hand off to another:

1. State **what was done** — files created or modified, build status, test results.
2. State **what the next agent needs to know** — feature name, namespace, any deviations from the plan.
3. Name **which agent to hand back to** (usually the orchestrator, coordinator, or planner).
4. Confirm the **completion checklist** is fully satisfied before handing off.

---

## Quality gate chain

The quality gate phase always runs in this order after all implementation is done:

```text
code-reviewer  →  security-reviewer
```

Both can run in parallel since they are read-only reviews. The work is **not done** until both approve.

Optional gates (add when relevant):

- `performance-reviewer` — for changes to projections, queries, or computationally intensive code
- `repository-investigation-reviewer` — when the change rests on a repository investigation's findings

---

## Agent file format

An agent is a single markdown file with YAML front matter followed by the agent's instructions:

```markdown
---
name: <Display Name>
description: >
  One or two sentences describing what this agent does and when to use it.
model: <model id>
tools:
  - <tool>
---

# <Display Name>

You are the **<Role>** for Cratis-based projects.

Always read and follow:
- `.ai/rules/general.md`
- the scoped `.ai/rules/*.md` relevant to the work

## Inputs you expect
...

## Process
...

## Completion checklist
- [ ] ...
```

The `description` is what an assistant sees when deciding whether to delegate, so write it as a routing signal, not a summary. Grant the narrowest tool set the role actually needs — a review agent that cannot write files cannot accidentally change the code it is reviewing.

---

## Adding a new agent

1. Create `<name>.md` in **`.ai/agents/`**.
2. Give it `name`, `description`, `model`, and `tools` front matter.
3. Point it at the canonical rules it must always read, and at the skills it should invoke.
4. Define the inputs it expects, its process, and its completion checklist.
5. Create the Copilot adapter `.github/agents/<name>.agent.md` pointing at `../../.ai/agents/<name>.md`. The Claude side needs nothing — `.claude/agents` is a folder symlink.
6. Add the agent to the roster table in this file.
7. Update the orchestrator's and coordinator's agent tables if the new agent should be delegated to.
8. Run `.ai/hooks/scripts/validate-ai-setup.sh` — a missing Copilot adapter is a fatal error there.
