<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Graph rendering

Requires Stage 4.222.0, which renders against Chronicle 19.129.0 and Arc 22.168.0. An older
Stage, or a Stage pinned to an older Chronicle, refuses every graph construct with `STAGE-ESM-063`.

## What renders

A Screenplay `graph` and its `projection ... => graph` become Chronicle's model-bound graph
types under `Graphs/<GraphName>/`:

| Modeled | Rendered |
| --- | --- |
| `node Person` | `record Person` marked `[Graph("<GraphName>")]`, `[Node]`, `[NoAutoMap]` |
| node `key` | the record's `[Key]` parameter; a key concept that is an event-source identity renders as the primitive it holds |
| `from E key <value>` | `[FromEvent<E>]` |
| `remove with E key <value> [detach]` | `[RemovedWith<E>]`, `Detach = true` for `detach` |
| `edge MEMBER_OF source A target B` | `record MemberOf` marked `[Edge("MEMBER_OF")]` with `[Source<A>]` and `[Target<B>]` keys |
| edge `from` / `remove with` | `[EdgeFrom<E>(...)]` / `[EdgeRemovedWith<E>(...)]` |
| `identified by p` | `p` is the edge's `[Key]`; every handler passes `identity:` |
| mappings and counters | `[SetFrom<E>]`, `[SetFromContext<E>]`, `[SetValue<E>]`, `[AddFrom<E>]`, `[SubtractFrom<E>]`, `[Increment<E>]`, `[Decrement<E>]` |
| `then graph` | a specification over Chronicle's `GraphScenario` that appends the events and asserts each node and edge |

A model that declares a graph also gets Neo4j wiring: `WithNeo4j()` in `Program.cs`, a
`Cratis.Arc.Neo4j` package reference, a `Cratis:Neo4j` section in `appsettings.json`
(`PasswordSecret: NEO4J_PASSWORD`, never the value) and a development Neo4j service in
`docker-compose.yml` that refuses to start without `NEO4J_PASSWORD`. Development uses
`DatabaseMode: Single` because Neo4j Community Edition has one user database; production keeps the
per-namespace default.

Stage's specification executor runs `given graph` and `then graph` with Screenplay's reference
graph runner and reports them with slice kind `Graph`.

## What is refused

| Code | Meaning | Fix |
| --- | --- | --- |
| `STAGE-ESM-063` | The pinned Chronicle client has no graph API | Upgrade Stage / the CLI bundle |
| `STAGE-ESM-062` | A construct the model-bound API cannot express: a non-PascalCase label, two elements rendering to one record, an undeclared edge identity, a factor (`add x by a * b`), `clear`, a non-text/boolean/whole-number literal, a key not read from an event property, the event source or a literal, one event handled twice by an element, or one element built by two projections | Reshape the model; never drop the construct |
| `STAGE-ESM-064` | A graph specification `GraphScenario` cannot express. A `given graph` seed is omitted as a degradation warning (`STAGE-DEGRADE-002`) and fails a `Strict` plan | Express the setup as appended events |
| `STAGE-ESM-065` | Non-blocking note: the live runtime (Play) does not project graphs | Verify with the specification executor |
| `STAGE-ESM-066` | A scoped plan leaves out the application's graphs | Render with the application scope |
| `STAGE-ESM-067` | The legacy syntax path met a graph construct | Use the executable semantic model path |

## Pitfall

Edge `[Source<>]`/`[Target<>]` keys use the node key's concept type. That satisfies Chronicle's
`CHR0024` when node keys are event-source identities; an edge between nodes keyed by another
concept can still be refused by `CHR0024` in the rendered build. Build the rendered application
before accepting a graph render.
