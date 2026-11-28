# Map the Elixir read model

In a module using `Cratis.Chronicle.ReadModels.ReadModel`, declare a struct with the destination fields and add `from BookAdded, set: [id: :event_source_id, title: :title]`. In the selected namespace inspect the result of `Cratis.Chronicle.all(Book)`. Check absent and present keys separately. When extending the mapping to another event, make sure it targets the same book key rather than creating another instance.

A missing single-instance result can mean the event has not yet been projected. Compare the observer checkpoint before diagnosing missing history. Bound client-side scans; use the ISO week-year for week keys rather than assuming the occurrence calendar year matches.

## Graph projections

Use a graph for relationship queries rather than joining materialized views. Define `Person` and `Group` with `use Cratis.Chronicle.Graphs.Node` and struct keys `person_id` and `group_id`. Define `Membership` with `use Cratis.Chronicle.Graphs.Edge, type: "MEMBER_OF"` and `defstruct membership_id: ""`. With those modules and the events in scope:

```elixir
defmodule Organization do
  use Cratis.Chronicle.Graphs.Graph, id: "Organization"

  node Person, key: :person_id do
    from PersonRegistered, key: :person_id
    removed_with PersonRemoved, key: :person_id, detach: true
  end

  node Group, key: :group_id do
    from GroupCreated, key: :group_id
  end

  edge Membership, source: Person, target: Group, identified_by: :membership_id do
    from MemberAdded, source_key: :person_id, target_key: :group_id, identity: :membership_id
    removed_with MemberRemoved,
      source_key: :person_id, target_key: :group_id, identity: :membership_id
  end
end
```

Without `identified_by:` there is one edge per type and endpoint pair. A node’s `detach: true` removes its incident edges; removing an identified edge removes only the named identity. Register `graphs: [Organization]` on `Cratis.Chronicle.Client`. Deploy a Neo4j sink on the kernel for the default `:neo4j`, or use `default_graph_sink_type_id: :in_memory_graph` in tests. The document sink option does not select a graph sink.

In ExUnit, build the registration with `Cratis.Chronicle.Graphs.DefinitionBuilder.projection_definition(Organization)`. Match the `:Graph` registration field: its `"MEMBER_OF"` edge’s `:From` and `:RemovedWith` mappings should have the same three paths in `:SourceKey`, `:TargetKey` and `:Identity`. Assert the `"Person"` removal has `:Detach` set to `true`. Exercise the real sink separately by removing one of two parallel edges and then detaching the node.

## Variants

Use `cratis_chronicle` 3.4.0 or later. `WorkItem` is an identity module, not a separate registered view. Append the registered events below under one work item source ID. Verify the deployed kernel maps `$eventSourceId` correctly for a full variant transition; client registration alone does not prove it.

```elixir
defmodule WorkItem do
end

defmodule BacklogItem do
  use Cratis.Chronicle.ReadModels.ReadModel
  defstruct id: "", title: ""

  variant_of WorkItem, key: :id
  enters_on IssueCreated
  from IssueCreated, set: [id: :event_source_id, title: :title]
end

defmodule PullRequestItem do
  use Cratis.Chronicle.ReadModels.ReadModel
  defstruct id: "", title: "", pull_request_url: "", build_status: ""

  variant_of WorkItem, key: :id
  enters_on PullRequestCreated
  from PullRequestCreated, set: [id: :event_source_id, pull_request_url: :pull_request_url]
  from BuildCompleted, set: [build_status: :build_status]
end

defmodule WorkItemTitleHandler do
  use Cratis.Chronicle.Projections.GlobalHandler, identity: WorkItem
  from TitleChanged, set: [title: :title]
end
```

For a declarative projection, keep only the struct and `use Cratis.Chronicle.ReadModels.ReadModel` on each model. Move each mapping block unchanged to its own module beginning with `use Cratis.Chronicle.Projections.Projection, model: BacklogItem` or `model: PullRequestItem`. Do not register both builders for the same model. Both DSLs accept `variant_of/2` and `enters_on/1,2`; use `enters_on Event, key: :work_item_id` only when the entrant uses that event field rather than the source ID. Register the selected builders and `global_handlers: [WorkItemTitleHandler]` or discover them with `otp_app:`. The shared title mapping must target a field present on both variants.

`BuildCompleted` is update-only because it isn't an entry event. In ExUnit with a disposable kernel namespace, append it before `PullRequestCreated` and wait for delivery; assert no `PullRequestItem` appears. Append the entry event and a second build with a different status on the same source; assert only the second status is visible on the pull request variant.
