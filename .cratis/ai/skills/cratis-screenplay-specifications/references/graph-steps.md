# Graph specification steps

## Contents

- Steps
- Example
- Rules

## Steps

| Step | Meaning |
| --- | --- |
| `has node <Label> <key>` | The node exists and the properties listed under it hold the given values. |
| `has edge <TYPE> from <source> to <target> [identified by <value>]` | The edge exists and the properties listed under it hold the given values. |
| `no node <Label> <key>` | The node does not exist. `then graph` only. |
| `no edge <TYPE> from <source> to <target> [identified by <value>]` | The edge does not exist. `then graph` only. |

## Example

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

      specification RemovingAPersonDetachesTheirEdges
        given graph Organization
          has node Person "6fa459ea-ee8a-4ca4-894e-db77e160355e"
            name = "Ada Lovelace"
          has node Group "0f8fad5b-d9cb-469f-a165-70867728950e"
          has edge MEMBER_OF from "6fa459ea-ee8a-4ca4-894e-db77e160355e" to "0f8fad5b-d9cb-469f-a165-70867728950e"
        when append PersonRemoved
          for "6fa459ea-ee8a-4ca4-894e-db77e160355e"
        then graph Organization
          no node Person "6fa459ea-ee8a-4ca4-894e-db77e160355e"
          no edge MEMBER_OF from "6fa459ea-ee8a-4ca4-894e-db77e160355e" to "0f8fad5b-d9cb-469f-a165-70867728950e"
          has node Group "0f8fad5b-d9cb-469f-a165-70867728950e"
```

The specification sits in the slice that declares the graph and its projection; they give
the steps their labels and keys. Check with `screenplay --warnaserror` and `screenplay test`.

## Rules

- Keys are the values of the node's `key` property, written as literals.
- A `has` step checks only the properties listed under it.
- A malformed step is `PLAY0875`; an undeclared graph, node label or edge type is
  `PLAY0876`; a property the node or edge does not declare is `PLAY0868`.
- The reference runner keeps an in-memory graph and applies the five operations of the
  projection. Values read from `$eventContext` are not materialized there, so do not
  assert an edge property mapped from `$eventContext`.
