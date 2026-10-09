## Discovery

Artifacts are found by **assembly scanning**, with no registration call and no DI
container required. `DefaultClientArtifactsProvider.Default` composes the
project-referenced and package-referenced assemblies
(`Source/Clients/DotNET/DefaultClientArtifactsProvider.cs:37`), and the
predicates are exactly (`:242-251`):

| Kind | Predicate |
| --- | --- |
| event types | `HasAttribute<EventTypeAttribute>()` or `HasAttribute<EventTypeGenerationForAttribute>()` |
| projections | `HasInterface(typeof(IProjectionFor<>))` |
| model-bound projections | `HasModelBoundProjectionAttributes()` |
| reactors | `HasInterface<IReactor>()` and not generic |
| read model reactors | `HasInterface<IReadModelReactor>()` and not generic |
| reducers | `HasInterface(typeof(IReducerFor<>))` and not generic |

Explicit registration is available per family as an alternative —
`IEventTypes.Register`, `IConstraints.Register`, `IProjections.Register`,
`IReducers.Register`, `IReactors.Register<TReactor>()`,
`IReadModels.Register<TReadModel>()` — and is what you use with
`AutoDiscoverAndRegister = false`.
