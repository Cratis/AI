# Declare both Elixir directions

Keep the same ID on the V1 and V2 event modules. Use `Cratis.Chronicle.Events.Migration, from: {AccountOpenedV1, generation: 1}, to: {AccountOpened, generation: 2}`. In `upcast(builder)`, `MigrationBuilder.rename_property(builder, :owner_name, :full_name)` maps the stored name forward. Reverse the property names in `downcast(builder)`. Verify a real old fact through both reader generations; a module compiling does not prove the schema transition.

For a schema deployment inspect `mix chronicle.discover` and the application `:drift_policy` before rollout. Choose `:fail` when unexpected drift must prevent registration. Successful discovery is not proof that historical values map correctly.
