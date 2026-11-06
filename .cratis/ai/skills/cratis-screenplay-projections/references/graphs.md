# Graph declarations and graph projections

## Contents

- Declaring a graph
- Projecting events onto it
- Reading the graph backwards
- The five operations
- What a graph projection cannot say
- Diagnostics

## Declaring a graph

A slice-level `graph`, a sibling of `readmodel`. Each `node` has typed properties and
exactly one `key`; each `edge` names existing node labels and may add properties.

```screenplay
concept PersonId : Uuid
concept GroupId : Uuid
concept PersonName : String

module Organization
  feature Chart
    slice StateView OrganizationChart
      graph Organization
        node Person
          personId PersonId key
          name     PersonName
        node Group
          groupId GroupId key
          name    String
        edge MEMBER_OF source Person target Group
          since DateTime
```

- A property is a primitive, a concept over one, or an array of those. A nested
  object, a `type` or a read model is `PLAY0863`: model it as another node and an edge.
- An edge is identified by type, source key and target key, so a repeated
  `MEMBER_OF` between one pair is the same edge. For several edges of one type
  between the same pair, write `edge HAS_ROLE source Person target Group identified by assignmentId`
  and declare `assignmentId` on the edge (`PLAY0871`).
- Edge types read best in `UPPER_SNAKE_CASE`.

## Projecting events onto it

Declared in the slice next to its graph; a standalone projection document cannot
hold one (`PLAY0877`). The model below is complete: events, graph and projection in one slice.

```screenplay
concept PersonId : Uuid
concept GroupId : Uuid
concept PersonName : String

module Organization
  feature Chart
    slice StateView OrganizationChart
      event PersonRegistered
        name PersonName

      event PersonRemoved

      event GroupCreated
        name String

      event MemberAdded
        groupId GroupId

      event MemberRemoved
        groupId GroupId

      graph Organization
        node Person
          personId PersonId key
          name     PersonName
        node Group
          groupId GroupId key
          name    String
        edge MEMBER_OF source Person target Group
          since DateTime

      projection OrganizationChart => graph Organization
        node Person
          from PersonRegistered key $eventSourceId
            name = name
          remove with PersonRemoved key $eventSourceId detach
        node Group
          from GroupCreated key $eventSourceId
            name = name
        edge MEMBER_OF
          from MemberAdded source $eventSourceId target groupId
            since = $eventContext.occurred
          remove with MemberRemoved source $eventSourceId target groupId
```

- `from <Event> key <expr>` creates or updates a node; `every` applies mappings to
  every `from` of the block; `remove with ... key <expr> [detach]` deletes it.
- An edge `from` takes `source <expr> target <expr>`; with `identified by` on the
  edge, every handler writes `identified by <expr>` after `target`.
- Mappings, counters (`increment`, `decrement`, `count`, `add ... by`, `subtract ... by`),
  `$eventContext` and AutoMap behave as in a read-model projection. A property the
  node or edge does not declare is `PLAY0868`.
- An edge `from` creates a missing endpoint as a bare node, so an event may draw an
  edge before the events that create its nodes arrive. A projection owns the edges
  and node properties it declares and never deletes a node it did not declare.

## Reading the graph backwards

1. List the questions the graph must answer ("who is in this group, including nested groups?").
2. Write each as a path: `Person -MEMBER_OF-> Group -PART_OF-> Group`.
3. Each hop is an edge type; each stop is a node label with a key.
4. For each edge type and node label, name the event that creates it and the one
   that removes it. Nothing creates it: add the fact to the event model, not a write
   to the graph.
5. Add `detach` to any node removal whose label has attached edges.
6. A question that is a lookup by key, not a path, belongs in a document read model.

## The five operations

Every sink applies the same idempotent operations: `UpsertNode`, `SetProperties`,
`DeleteNode` (with or without `detach`), `UpsertEdge`, `DeleteEdge`. Nodes are
identified by label and key; edges by type, source, target and the `identified by` value.

## What a graph projection cannot say

`children`, `nested`, `join`, `all`, `clear with`, `remove via join`, `variant`, a
projection-level `key` or `sequence`, and `automap` blocks are `PLAY0872`. There is
no engine-native block: whatever the language cannot say is not supported. The event
model board, find-references and rename do not follow graph projections, so renaming
an event leaves a graph projection reported as unknown.

## Diagnostics

| Code | Meaning |
| --- | --- |
| `PLAY0862` | Malformed graph, node or edge declaration |
| `PLAY0863` | Property type not a primitive, concept or array of those |
| `PLAY0864` | Node with no `key` or more than one |
| `PLAY0865` | Edge names an undeclared source or target label |
| `PLAY0866` | Projection targets an undeclared graph |
| `PLAY0867` | Block for a label or edge type the graph does not declare |
| `PLAY0868` | Mapped, identity or asserted property the node or edge lacks |
| `PLAY0869` | `detach` on an edge |
| `PLAY0870` | Warning: node removal without `detach` while edges attach to the label |
| `PLAY0871` | `identified by` names a property the edge does not declare |
| `PLAY0872` | Read-model-only construct in a graph projection |
| `PLAY0873` | Malformed block or handler, missing `key` or `source`/`target` |
| `PLAY0874` | Duplicate declaration or duplicate node/edge build in one projection |
| `PLAY0875` | Malformed `given graph` / `then graph` step |
| `PLAY0876` | Specification names an undeclared graph, label or edge type |
| `PLAY0877` | Graph projection declared outside a slice |
