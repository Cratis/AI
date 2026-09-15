---
name: cratis-performance-review
description: Perform a focused scalability review of changed code in a Cratis application — Chronicle observers and replay, read-model query shape, command and query payloads, .NET enumeration, and React render cost — and report findings by risk. Use when asked to check for performance or scalability problems. Do not use for ordinary implementation and do not override the authoritative paging guidance.
license: MIT
---

# Cratis performance review

Most performance findings in a Cratis application are shape problems, not
hot-loop problems: a projection that has to re-read, a query that materializes
before it filters, a payload nobody uses. They are cheap to fix while the change
is open and expensive once data has grown behind them.

Two things make this stack different. **A projection must be able to replay the
entire history** — a cost that is invisible at development volumes and fatal at
production ones. And **an event is permanent**, so an oversized event is a
storage and replay cost that never goes away.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Chronicle` | `16.45.2` | Observers, projections, reducers, reactors, replay |
| `Cratis.Arc.Core` | `22.10.4` | Query return shapes and server-side paging |
| `@cratis/components` | current | `DataTable` paging surface |

Reverify against the owning product repository before asserting a framework
behavior this file does not already state.

## Route near misses

- General correctness and maintainability: use `cratis-code-review`. Its
  performance section is the pass-by list; this skill is the focused one. When
  both have run, do not restate the same finding twice.
- Adding paging to a query rather than judging one: use
  `cratis-arc-query-paging`. That skill is authoritative on the mechanism; this
  one does not override it.
- Security or data exposure: use `cratis-security-review`. An over-fetching
  payload is a finding for both — say which lens produced it.

## Step 1 — Chronicle and event sourcing

- **A projection joins on events, never on a read model.** A read-model join
  forces a re-read the projection engine cannot optimize, and it makes the
  projection depend on another observer's position.
- **A reactor does not re-query the event log inside its handler.** The event it
  received already carries what it needs. (Reactor dispatch is by the handler's
  first parameter type — the method name is free, so look for the event-typed
  parameter, not for a method called `On`.)
- **A new projection can replay all historical events without failing.** Ask it
  explicitly: at production volume, does this projection complete a full replay?
- **Events are small.** No large blob and no base64 payload embedded in an
  event; put the content elsewhere and carry a reference.
- No eager load of a whole event sequence without paging or filtering.
- AutoMap is on by default. Hand-mapping every property is both a maintenance
  and a cost problem — and, since AutoMap runs anyway, it does not save the work
  it appears to.

## Step 2 — Read models and their store

- Queries filter on indexed fields. An unintentional full-collection scan is the
  most common finding here.
- **A list that can grow returns `IQueryable<T>`**, so Arc applies server-side
  paging and sorting. Materializing and then slicing in memory reads the whole
  collection every request.
- No N+1: one query returns what the caller needs.
- A count is a count. Hydrating the collection to measure its length is the
  same finding as an unpaged list, wearing different clothes.
- A read model does not embed a large nested collection nothing fully iterates.

## Step 3 — Commands and queries

- A response payload carries only fields the client uses.
- Command validators are synchronous and in-memory. Validation is on the hot
  path of every attempt, including the ones that will be rejected — an I/O call
  there is paid on every request.
- No `await Task.Run(() => syncWork)` wrapping for work that is naturally
  asynchronous.

## Step 4 — .NET

- No `.ToList()` before `.Where()`. Filter before materializing.
- An `IEnumerable<T>` is not enumerated more than once — materialize once when
  it must be reused.
- Large-object logging uses the destructuring form only at `Debug` level, so a
  production log level does not pay to serialize it.

## Step 5 — React

- A `DataTable` over a growable collection uses lazy loading and a paginator
  rather than rendering every row.
- No inline object or array literal passed as a prop: it is a new identity every
  render and defeats memoization downstream.
- `useEffect` dependencies are correct — neither missing nor over-broad. An
  over-broad dependency array is a re-run per render, which reads as a
  correctness bug and behaves as a performance one.
- Components over large collections hold stable references or are memoized.
- No `JSON.parse(JSON.stringify(x))` deep cloning.

## Step 6 — Report

Open with one line:

> **Performance review: No issues / Minor findings / Blocking issues found**

Group findings by the section that produced them, and classify each:

| Risk | Meaning |
| --- | --- |
| **High** | Measurable degradation at moderate load — fix before merge |
| **Medium** | Degrades under load or as data grows |
| **Low** | Minor inefficiency |

Close with a per-section summary table.

**Say what the finding costs and at what scale.** "This is slow" is not
actionable; "this scans the whole collection on every page load, so it is fine
at hundreds of rows and not at tens of thousands" is. And **name what you did
not measure** — a review of code shape is not a benchmark, and reporting it as
one overstates the evidence.

## What breaks

- **A shape finding is reported as a measurement.** Reading code tells you the
  shape; only running it tells you the cost. Say which one you have.
- **The paging advice contradicts the paging skill.** `cratis-arc-query-paging`
  is authoritative on the mechanism. Report the missing paging; do not invent an
  alternative to it.
- **A replay cost is judged at development volume.** A projection over a hundred
  seeded events proves nothing about a replay over a production history.
- **Every finding is High.** The classification is the value; when all findings
  are urgent, none are.

## How it is proven

The build and specifications are green before the report is written; each
finding cites the file and line and states the scale at which it bites; and the
report says plainly that it reviewed code shape rather than measured behavior,
naming anything that would need a benchmark to settle.
