<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Seeded state and store-backed processing

Verified at Chronicle **v19.110.1**, `Source/Clients/Testing/ReadModels/`
(`ReadModelSourceGivenBuilder.cs`, `ReadModelScenario.cs`) and
`Source/Clients/Testing/Events/EventStoreForTesting.cs`.

From 19.82.1, `await scenario.Given.ForEventSourceId(id).ReadModel(instance)`
sets initial state for both `InstanceForEventSourceId(id)` and
`scenario.ReadModels.GetInstanceById<T>(id)`; it does not create event history.
Use it for handler setup, not as proof that a projection built the instance.

For already stored `AppendedEvent` values, `ProcessAppendedEvents(...)` folds
those values rather than appending them a second time. From 19.89.0 projections
and reducers use the store-backed processor, so projection changes persist
where `scenario.ReadModels` reads them. These behaviors do not prove kernel
storage or replay durability.

From 19.106.0, default test stores share a JSON schema generator per process,
while each store gets a separate schema copy. Set
`EventStoreForTesting.ShareSchemaGenerator = false` for per-store metadata
providers; custom service providers already bypass sharing. Configure the
static switch at suite setup, not concurrently between specifications.
