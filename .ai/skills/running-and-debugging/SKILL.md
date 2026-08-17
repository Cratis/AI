---
name: running-and-debugging
description: Inspect and repair a running Cratis Chronicle event store from the terminal with the cratis CLI — diagnose server health, read observer state, find and retry failed partitions, clear a quarantined observer, replay an observer, and read raw events and read-model instances. Use when a read model is wrong or stale in a running system, an observer or projection has stopped, a reactor's side effect never happened, or someone asks what the event store is actually doing right now.
---

# Running and Debugging a Live Cratis System

`diagnose-slice` answers *"which rule did my code break?"* by routing a symptom to the rule or
skill that owns it. This skill answers the other half: **what is the running system actually
doing?** Its evidence comes from the store itself, through the `cratis` CLI, not from a document.

Use both. Observe first, then fix the code.

## When to use this skill

- A read model is empty, stale, or wrong **in a running system** and you need to know whether the
  observer that builds it is healthy, behind, failed, or quarantined.
- A reactor's side effect never happened and you need the exception that stopped it.
- You are on a box over SSH, or in CI, and the Chronicle Workbench browser UI is not reachable.
- Someone asks for the state of an event store: which stores, which observers, which jobs.
- You have fixed the cause of a failure and need to retry or replay the affected work.

Not for: choosing an architecture, writing a slice, or diagnosing a compile-time or proxy problem
— those are `new-vertical-slice` and `diagnose-slice`.

## Prerequisites

- A **running** Chronicle server. Nothing here inspects source code.
- The `cratis` CLI installed. Homebrew (`brew tap cratis/cratis && brew install cratis`), a native
  binary from the releases, or `dotnet tool install -g Cratis.Cli`.
- If the store is not on `chronicle://localhost:35000`, a context or `--server` — see
  [Connecting](./references/cratis-cli.md#connecting).

Local development needs no configuration: the CLI falls back to `chronicle://localhost:35000`
with Chronicle's well-known development credentials, which is exactly what the templates start.

## Steps

### Step 1 — Ask the whole server first

```bash
cratis chronicle diagnose
```

One verdict covering connection, server version, event stores, observers, failed partitions,
recommendations, and the event-sequence tail. **Every failing line prints the command that
investigates it**, and the command exits non-zero when it finds something — so it also works as a
health check in a script or a CI step. `--watch` refreshes it in place.

Start here even when you think you know the answer. It is the cheapest way to separate "the
environment is broken" from "my projection is wrong".

### Step 2 — Read the observers, carefully

```bash
cratis chronicle observers list
cratis chronicle observers list --type projection     # reactor | reducer | projection | all
cratis chronicle observers show <observer-id>
```

Two columns are routinely misread:

| Column | What it means |
|---|---|
| `Next#` | the next sequence number this observer will look at |
| `LastHandled#` | the last event it actually processed |
| `State` | `Active`, `Replaying`, `Suspended`, `Disconnected`, `Quarantined`, `Unknown` |
| `Subscribed` | whether a client is currently attached |

**`LastHandled#` lagging the tail is normal and is not the same as being behind.** An observer
that only cares about one event type will sit at the sequence number of the last such event while
`Next#` tracks the tail — it is caught up, with nothing addressed to it.

This is why `diagnose` reports **failed partitions rather than sequence lag**: lag is ambiguous, a
failed partition is not. Do not raise an alarm from a `LastHandled#` gap alone.

`Disconnected` means no client is attached — normally just an application that is not running. It
is not an error.

### Step 3 — Follow a failure to the event that caused it

A **partition** is one event source's slice of an observer. When processing throws, Chronicle
stops that partition and leaves the rest of the observer running, so one bad entity does not halt
everything.

```bash
cratis chronicle failed-partitions list
cratis chronicle failed-partitions list --observer <observer-id>
cratis chronicle failed-partitions show <observer-id> <partition>
```

`show` prints the exception per attempt. The partition key is the **event source id** your
application uses, so the failure names the actual entity — which is what makes it addressable
rather than merely reported.

Chronicle retries on its own with widening backoff, so a partition that failed on something
transient recovers without you. Read before you act.

### Step 4 — Recover, smallest hammer first

```bash
cratis chronicle observers retry-partition <observer-id> <partition> -y
cratis chronicle observers replay-partition <observer-id> <partition> -y
cratis chronicle observers clear-quarantine <observer-id> -y
cratis chronicle observers replay <observer-id> -y
```

In increasing order of cost:

| Command | What it does | Use when |
|---|---|---|
| `retry-partition` | Retries one partition from where it failed | You fixed the cause and do not want to wait for the next automatic attempt |
| `replay-partition` | Reprocesses one partition from the beginning | That one entity's derived state is wrong, not just stuck |
| `clear-quarantine` | Lets a quarantined observer resume | The observer is `Quarantined` and the handler defect is fixed |
| `replay` | Reprocesses the whole observer from sequence zero and rebuilds its read model | The projection logic itself changed |

`replay` loses nothing — events are immutable and replay is what they are for — but on a large
store it is neither instant nor free. **Reach for `retry-partition` first.**

All four prompt for confirmation; `-y` skips it for scripts.

> `clear-quarantine` requires a Chronicle version whose contracts support it. If they do not, the
> CLI says so explicitly rather than pretending it worked.

### Step 5 — Compare the events against the state they produced

When the observer is healthy and the read model is still wrong, the defect is in the projection or
reducer, not the runtime:

```bash
cratis chronicle events get --from 100 --to 200 -o plain
cratis chronicle events get --event-type <EventType> --event-source-id <id> -o plain
cratis chronicle events tail
cratis chronicle read-models list
cratis chronicle read-models instances <ReadModel> -o plain
cratis chronicle read-models get <ReadModel> <key>
```

Read the events that should have produced the state, then read the state. A field that stayed at
its default while the event carried a value is a mapping problem — hand off to `diagnose-slice`
and `add-projection`. A field with no source event at all is a modeling problem — `event-modeling`.

Use `-o plain` on anything that returns many rows; it is several times smaller than JSON because
JSON repeats every field name on every row.

### Step 6 — Hand the finding back to the code

The CLI tells you *what* is wrong in the running system. Fixing it is a code change under the
normal gates:

- `diagnose-slice` — symptom → the rule or skill that owns the fix.
- `add-projection`, `add-reactor`, `cratis-readmodel` — the artifact that needs changing.
- `write-specs` — **reproduce the defect with a spec before and after the fix.** A partition that
  failed once will fail again on replay if the handler is still wrong.

## Completion checklist

- [ ] `cratis chronicle diagnose` run and its verdict read
- [ ] Observer state distinguished from observer lag — no alarm raised from `LastHandled#` alone
- [ ] Any failed partition inspected with `failed-partitions show` before any recovery command
- [ ] Recovery used the smallest sufficient action (`retry-partition` before `replay`)
- [ ] The underlying defect reproduced by a spec and fixed in source, not only recovered at runtime
- [ ] `cratis chronicle diagnose` green afterward

## See also

- [The cratis CLI](./references/cratis-cli.md) — install, connect, full command surface, output formats.
- `diagnose-slice` — the code-side symptom router; the complement to this skill.
- `getting-started` — get a Chronicle store running in the first place.
- `observable-query-curl` — inspect an Arc observable query over plain HTTP.
- [glossary.md](../../rules/glossary.md) — observer, partition, quarantine, replay, event sequence.
