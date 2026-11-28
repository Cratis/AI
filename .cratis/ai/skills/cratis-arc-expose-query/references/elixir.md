# Expose a finite query before making it live

Declare `use Cratis.Arc.ReadModel, model: Author`. An `@query` function takes `(args, ctx)` and returns `{:ok, value}` or `{:error, results}`. Declare the result cardinality and typed arguments; do not rely on nested list binding. Use `%Cratis.Arc.Page{}` for an already paged result rather than paging it again.

For later values annotate the function `@observe many: true, watch: [Author]`: a watched model change reruns the function in subscription scope. Alternatively `topics: [...]` can trigger local re-execution through `Cratis.Arc.Notifier`; it is not a cross-node bus. Bursts are debounced by 25 ms. Verify a write to a watched model actually changes the subscribed result.

For example `@query params: [id: :uuid], many: false` binds the UUID before calling the function. Supported primitives include string, integer, float, boolean, UUID, date, datetime and map. A query argument list of scalars is not arbitrary recursive JSON binding; keep structured inputs within the released query binder's shapes.
