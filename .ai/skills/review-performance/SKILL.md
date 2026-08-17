---
name: review-performance
description: Use this skill when asked to check for performance issues, inefficiencies, or scalability problems in a Cratis-based project. Covers Chronicle projections, MongoDB query patterns, .NET allocations, and React render overhead.
---

Perform a focused performance review of changed code.

## Chronicle / Event Sourcing

- [ ] Projections use AutoMap (on by default) — avoids manual mapping cost
- [ ] Projections do NOT join on the read model (forces full re-read)
- [ ] Reactors do NOT re-query the event log inside `On()` — use event data directly
- [ ] No eager loading of entire event sequences without paging/filtering
- [ ] New projections can replay all historical events without crashing
- [ ] Events are small — no large blobs or base64-encoded content embedded

## MongoDB / Read Models

- [ ] Queries filter on indexed fields — no unintentional full-collection scans
- [ ] A query that can return many rows returns `IQueryable<T>` (or `ISubject<IEnumerable<T>>`) and lets **Arc** apply paging and sorting — flag hand-written `.Skip()` / `.Take()` / `.OrderBy()` and any hard-coded `Take(n)`, which caps the result set no matter what page the client asked for (see the **query-paging** skill)
- [ ] No N+1 pattern — single query returns all needed data
- [ ] Read-model records do not embed large nested collections that are never fully iterated

## ASP.NET Core / Commands & Queries

- [ ] Query endpoints do not hydrate the full collection when only a count is needed
- [ ] Command validators are synchronous and in-memory — no I/O in validation
- [ ] No `await Task.Run(() => syncWork)` wrapping for naturally async work
- [ ] Response payloads include only fields the client uses — no over-fetching

## React / TypeScript

- [ ] `DataTable` uses `lazy` + `paginator` for collections larger than ~20 rows
- [ ] No inline object/array literals passed as props (causes identity change every render)
- [ ] `useEffect` dependencies are correct — no missing deps, no over-broad deps
- [ ] Large-collection components wrapped in `React.memo` or use stable references
- [ ] No `JSON.parse(JSON.stringify(x))` deep cloning

## General .NET

- [ ] No LINQ `.ToList()` before `.Where()` — filter before materialising
- [ ] `IEnumerable<T>` not enumerated multiple times — materialise once if needed
- [ ] Large object logging uses `{@obj}` only at `Debug` level

## Risk classification

- 🔴 High — measurable degradation at moderate load — must fix before merge
- 🟡 Medium — could degrade under load or at scale
- 🟢 Low — minor inefficiency or style issue

## Output format

Start with: **Performance Review: ✅ No issues / ⚠️ Minor findings / ❌ Blocking issues found**

Group findings by category. End with a summary table showing ✅/⚠️/❌ per category.
