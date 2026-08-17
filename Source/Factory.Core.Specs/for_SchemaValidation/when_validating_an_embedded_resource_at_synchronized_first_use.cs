// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections;
using System.Reflection;
using Json.Schema;

namespace Cratis.Factory.for_SchemaValidation;

public class when_validating_an_embedded_resource_at_synchronized_first_use : Specification
{
    const string RootId = "https://schemas.cratis.io/factory/tests/embedded-cold-root.schema.json";
    const string EmbeddedId = "https://schemas.cratis.io/factory/tests/embedded-cold-resource.schema.json";
    const string ExternalId = "https://schemas.cratis.io/factory/tests/embedded-cold-external.schema.json";
    const int ConsumerCount = 8;
    SchemaLoadResult _load = null!;
    SchemaResourceSet _resourceSet = null!;
    SchemaValidationResult[] _results = null!;
    JsonSchema _wrapperBefore = null!;
    JsonSchema _wrapperAfter = null!;
    WrapperSnapshot _snapshotBefore = null!;
    WrapperSnapshot _snapshotAfter = null!;
    Exception? _exception;
    int _fetchCount;

    void Because()
    {
        var global = SchemaRegistry.Global;
        var originalFetch = global.Fetch;
        global.Register(new Uri(ExternalId), JsonSchema.False);
        global.Fetch = (_, _) =>
        {
            Interlocked.Increment(ref _fetchCount);
            return JsonSchema.False;
        };
        try
        {
            _exception = Catch.Exception(() =>
            {
                _load = SchemaResourceSet.Load([
                    new SchemaDocument(RootId, Encoding.UTF8.GetBytes($$$$"""
                        {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{{{RootId}}}}","$defs":{"embedded":{"$id":"{{{{EmbeddedId}}}}","$defs":{"local":{"type":"integer"}},"type":"object","properties":{"external":{"$ref":"{{{{ExternalId}}}}"},"local":{"$ref":"#/$defs/local"}},"required":["external","local"],"additionalProperties":false}}}
                        """)),
                    new SchemaDocument(ExternalId, Encoding.UTF8.GetBytes($$$$"""
                        {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{{{ExternalId}}}}","type":"string"}
                        """))
                ]);
                if (_load.ResourceSet is null)
                {
                    throw new InvalidOperationException(string.Join(',', _load.Diagnostics.Select(_ => _.Code.ToString())));
                }

                _resourceSet = _load.ResourceSet;
                _wrapperBefore = GetPackageWrapper(_resourceSet, EmbeddedId);
                _snapshotBefore = Snapshot(_wrapperBefore);
                _results = ValidateConcurrently(_resourceSet);
                _wrapperAfter = GetPackageWrapper(_resourceSet, EmbeddedId);
                _snapshotAfter = Snapshot(_wrapperAfter);
            });
        }
        finally
        {
            global.Fetch = originalFetch;
        }
    }

    [Fact] void should_not_throw() => _exception.ShouldBeNull();
    [Fact] void should_load_the_explicit_resource_set() => _load.Status.ShouldEqual(SchemaLoadStatus.Loaded);
    [Fact] void should_have_resolved_both_embedded_references_at_load() =>
        (_snapshotBefore is not null && (_snapshotBefore.ReferenceCount, _snapshotBefore.Targets.Count) == (2, 2)).ShouldBeTrue();
    [Fact] void should_use_the_explicit_local_and_external_targets() =>
        (_results?.All(_ => _.Status == SchemaValidationStatus.Valid) ?? false).ShouldBeTrue();
    [Fact] void should_never_invoke_the_package_global_fetch_hook() => _fetchCount.ShouldEqual(0);
    [Fact] void should_preserve_the_embedded_package_wrapper() =>
        (_wrapperBefore is not null && ReferenceEquals(_wrapperBefore, _wrapperAfter)).ShouldBeTrue();
    [Fact] void should_preserve_the_resolved_reference_targets() =>
        (_snapshotBefore is not null &&
         _snapshotAfter is not null &&
         _snapshotAfter.ReferenceCount == _snapshotBefore.ReferenceCount &&
         _snapshotAfter.Targets.Count == _snapshotBefore.Targets.Count &&
         _snapshotAfter.Targets.Zip(_snapshotBefore.Targets).All(_ => ReferenceEquals(_.First, _.Second))).ShouldBeTrue();
    [Fact] void should_return_one_deterministic_material_result() =>
        (_results?.Skip(1).All(_ => MateriallyEquals(_results[0], _)) ?? false).ShouldBeTrue();

    static SchemaValidationResult[] ValidateConcurrently(SchemaResourceSet resourceSet)
    {
        var results = new SchemaValidationResult[ConsumerCount];
        using var ready = new CountdownEvent(ConsumerCount);
        using var start = new ManualResetEventSlim();
        var consumers = Enumerable.Range(0, ConsumerCount)
            .Select(index => Task.Factory.StartNew(
                () =>
                {
                    ready.Signal();
                    start.Wait();
                    results[index] = resourceSet.Validate(EmbeddedId, "{\"external\":\"value\",\"local\":42}"u8);
                },
                CancellationToken.None,
                TaskCreationOptions.LongRunning,
                TaskScheduler.Default))
            .ToArray();
        ready.Wait();
        start.Set();
        Task.WaitAll(consumers);
        return results;
    }

    static JsonSchema GetPackageWrapper(SchemaResourceSet resourceSet, string schemaId)
    {
        var resources = (IEnumerable)typeof(SchemaResourceSet)
            .GetField("_resources", BindingFlags.Instance | BindingFlags.NonPublic)!
            .GetValue(resourceSet)!;
        foreach (var entry in resources)
        {
            var entryType = entry!.GetType();
            if (!string.Equals((string)entryType.GetProperty("Key")!.GetValue(entry)!, schemaId, StringComparison.Ordinal))
            {
                continue;
            }

            var resource = entryType.GetProperty("Value")!.GetValue(entry)!;
            return (JsonSchema)resource.GetType().GetProperty("Schema")!.GetValue(resource)!;
        }

        throw new InvalidOperationException("The embedded package wrapper was not found.");
    }

    static WrapperSnapshot Snapshot(JsonSchema schema)
    {
        var pending = new Stack<JsonSchemaNode>();
        var visited = new HashSet<JsonSchemaNode>(ReferenceEqualityComparer.Instance);
        var targets = new List<JsonSchemaNode>();
        var referenceCount = 0;
        pending.Push(schema.Root);
        while (pending.Count > 0)
        {
            var node = pending.Pop();
            if (!visited.Add(node)) continue;

            foreach (var keyword in node.Keywords)
            {
                if (string.Equals(keyword.Handler.GetType().Name, "SafeRefKeyword", StringComparison.Ordinal))
                {
                    referenceCount++;
                    targets.AddRange(keyword.Subschemas);
                }

                foreach (var subschema in keyword.Subschemas)
                {
                    pending.Push(subschema);
                }
            }
        }

        return new(referenceCount, targets);
    }

    static bool MateriallyEquals(SchemaValidationResult left, SchemaValidationResult right) =>
        left.Status == right.Status &&
        string.Equals(left.SchemaId, right.SchemaId, StringComparison.Ordinal) &&
        left.SchemaSetIdentity == right.SchemaSetIdentity &&
        left.Closure == right.Closure &&
        left.Diagnostics.SequenceEqual(right.Diagnostics);

    sealed record WrapperSnapshot(int ReferenceCount, IReadOnlyList<JsonSchemaNode> Targets);
}
