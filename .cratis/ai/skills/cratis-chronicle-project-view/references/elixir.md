# Map the Elixir read model

In a module using `Cratis.Chronicle.ReadModels.ReadModel`, declare a struct with the destination fields and add `from BookAdded, set: [id: :event_source_id, title: :title]`. In the selected namespace inspect the result of `Cratis.Chronicle.all(Book)`. Check absent and present keys separately. When extending the mapping to another event, make sure it targets the same book key rather than creating another instance.

A missing single-instance result can mean the event has not yet been projected. Compare the observer checkpoint before diagnosing missing history. Bound client-side scans; use the ISO week-year for week keys rather than assuming the occurrence calendar year matches. A graph is a separate read shape: `node` and `edge` declarations require a deployed graph-capable sink. Do not turn a graph relationship into a join between two materialized models.
