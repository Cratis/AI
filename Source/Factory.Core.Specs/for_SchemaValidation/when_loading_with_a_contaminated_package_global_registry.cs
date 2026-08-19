// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Json.Schema;

namespace Cratis.Factory.for_SchemaValidation;

public class when_loading_with_a_contaminated_package_global_registry : Specification
{
    const string RootId = "https://schemas.cratis.io/factory/tests/global-a-root.schema.json";
    const string TargetId = "https://schemas.cratis.io/factory/tests/global-z-target.schema.json";
    SchemaLoadResult _load = null!;
    SchemaValidationResult _validation = null!;
    int _fetchCount;

    void Because()
    {
        var global = SchemaRegistry.Global;
        var originalFetch = global.Fetch;
        global.Register(new Uri(TargetId), JsonSchema.False);
        global.Fetch = (_, _) =>
        {
            Interlocked.Increment(ref _fetchCount);
            return JsonSchema.False;
        };
        try
        {
            _load = SchemaResourceSet.Load([
                new SchemaDocument(RootId, Encoding.UTF8.GetBytes($$"""
                    {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{RootId}}","$ref":"{{TargetId}}"}
                    """)),
                new SchemaDocument(TargetId, Encoding.UTF8.GetBytes($$"""
                    {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{TargetId}}","type":"string"}
                    """))
            ]);
            _validation = _load.ResourceSet!.Validate(RootId, "\"value\""u8);
        }
        finally
        {
            global.Fetch = originalFetch;
        }
    }

    [Fact] void should_load_only_the_explicit_resource_set() => _load.Status.ShouldEqual(SchemaLoadStatus.Loaded);
    [Fact] void should_use_the_explicit_target_instead_of_the_global_substitute() => _validation.Status.ShouldEqual(SchemaValidationStatus.Valid);
    [Fact] void should_never_invoke_the_package_global_fetch_hook() => _fetchCount.ShouldEqual(0);
}
