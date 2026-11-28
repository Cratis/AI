# Map properties with Kotlin references

Extend `EventTypeMigration<PersonV2, PersonV1>(PersonV2::class, PersonV1::class)`. In `upcast`, map `builder.renamedFrom(PersonV2::fullName, PersonV1::name)` and provide a truthful default for any required new field. In `downcast`, reverse the types and use `builder.renamedFrom(PersonV1::name, PersonV2::fullName)`. Confirm the two declarations share the deployed ID; a new class name alone is not a generation relationship.
