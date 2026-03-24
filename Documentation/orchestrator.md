# Using the Orchestrator

The Orchestrator is the **top-level team manager** for Cratis-based projects. Use it as the entry point whenever a goal is large enough to require multiple specialist agents working together as a team.

See also: [Agent Roster](./agents.md) · [Architecture Overview](./architecture.md)

---

## What the Orchestrator does

The Orchestrator receives a high-level goal and:

1. **Classifies the work** — identifies every concern: implementation, documentation, testing, review, refactoring.
2. **Assembles the right team** — maps each concern to the appropriate specialist agent.
3. **Sequences the work** — groups independent tasks into parallel phases; enforces dependencies.
4. **Delegates in phase order** — hands off to each agent and waits for completion before advancing.
5. **Tracks overall progress** — reports what was completed, what is running, and what remains.
6. **Enforces quality gates** — ensures code review and security review pass before declaring success.

The Orchestrator does **not** write code or documentation itself. Every concrete task is delegated.

---

## When to use the Orchestrator

Use the Orchestrator when your goal spans **more than one type of work**:

| Scenario | Use |
|---|---|
| Implement a feature **and** document it | `orchestrator` |
| Implement multiple independent features in parallel | `orchestrator` |
| Implement a feature, write specs, review, and document | `orchestrator` |
| Large refactor across multiple slices with review | `orchestrator` |
| Implement a single feature end-to-end | `planner` or `coordinator` |
| Write backend code for one slice | `backend-developer` |

If you are unsure, use the Orchestrator — it will route you to the right sub-agent.

---

## The agent team

The Orchestrator coordinates this team of specialists:

| Agent | Role |
|---|---|
| `coordinator` | Cross-cutting implementation — backend + frontend + reviews across multiple concerns |
| `planner` | Vertical slice implementation — sequences backend → build → frontend → specs |
| `backend-developer` | C# slice files — commands, events, validators, projections, reactors |
| `frontend-developer` | React/TypeScript components, composition pages, routing |
| `spec-writer` | BDD integration specs (C#) and unit specs (TypeScript) |
| `code-reviewer` | Architecture conformance, C# and TypeScript standards |
| `security-reviewer` | Injection, auth/authz, data exposure, event-sourcing vulnerabilities |
| `performance-reviewer` | Chronicle projections, MongoDB queries, .NET allocations, React overhead |

---

## How the Orchestrator plans work

The Orchestrator always outputs a **team plan** before delegating anything. The plan is a phased markdown checklist:

```markdown
## Orchestration Plan: Add Author Registration with documentation

### Phase 1 — Backend [parallel]
- [ ] [planner] Implement Authors / Registration slice (State Change)
- [ ] [planner] Implement Authors / Listing slice (State View)

### Phase 2 — Build synchronisation point
- [ ] Run `dotnet build`

### Phase 3 — Frontend + Specs [parallel]
- [ ] [frontend-developer] AddAuthor.tsx and Listing.tsx components
- [ ] [spec-writer] Integration specs for Registration slice

### Phase 4 — Quality Gates [parallel]
- [ ] [code-reviewer] Review all changed files
- [ ] [security-reviewer] Security review of all changed files

### Phase 5 — Documentation
- [ ] Document the Authors feature in the Documentation folder
```

---

## Parallelisation model

The Orchestrator applies the same phase rules as the Coordinator and Planner, extended to non-implementation streams:

```
Phase 1: Backend (C#)  ───────────────────────────────────┐
                                                           ▼
Phase 2: dotnet build ← synchronisation point
                                                           ▼
Phase 3: Frontend ─────────────┐   Specs ────────────────┘  (parallel)
                                                           ▼
Phase 4: Quality Gates (code-reviewer + security-reviewer) (parallel)
                                                           ▼
Phase 5: Documentation (references the completed, reviewed implementation)
```

**Key rules:**
- Frontend and backend for the **same slice** are never parallel (frontend depends on generated proxies).
- Independent slices (no shared events) can have their backends run in parallel.
- Documentation of new features must wait until the implementation is reviewed.

---

## Orchestrator vs Coordinator vs Planner

All three agents decompose work and delegate — but at different levels:

| Agent | Scope | Delegates to |
|---|---|---|
| `orchestrator` | Any goal — implementation, docs, reviews, refactoring | `coordinator`, `planner`, `code-reviewer`, `security-reviewer`, specialist agents |
| `coordinator` | Implementation — backend + frontend + reviews | `backend-developer`, `frontend-developer`, `spec-writer`, `code-reviewer` |
| `planner` | Vertical slices only — one or more slices end-to-end | `backend-developer`, `frontend-developer`, `spec-writer`, `code-reviewer` |

Choose the **most specific** agent that fits the goal:
- Vertical slices only → `planner`
- Implementation across concerns → `coordinator`
- Everything else → `orchestrator`

---

## Progress reporting

After each phase completes, the Orchestrator outputs a progress update:

```markdown
## Progress update

### ✅ Completed
- Phase 1: Authors/Registration and Authors/Listing backends implemented

### 🔄 In progress
- Phase 2: Running dotnet build

### ⏳ Remaining
- Phase 3: Frontend components + integration specs
- Phase 4: Quality gates
- Phase 5: Documentation
```

This makes it easy to resume an interrupted session — share the last progress update with the Orchestrator and it will pick up where it left off.

---

## Quality gates

The Orchestrator enforces the following quality gate chain before declaring success:

```
code-reviewer  ──┐
                  ├──▶ both must approve
security-reviewer ┘
```

Both reviewers run in parallel. The goal is **not done** until both approve. If either finds blocking issues, the relevant specialist agent is re-engaged to fix them, then the reviewers run again.

Optional quality gate:
- `performance-reviewer` — use when the implementation touches Chronicle projections, MongoDB queries, or compute-intensive React rendering.
