// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_validating_one_resource_set_at_synchronized_first_use : Specification
{
    const string SchemaId = "https://schemas.cratis.io/factory/tests/cold-parallel.schema.json";
    const int ConsumerCount = 16;
    SchemaResourceSet _resourceSet = null!;
    SchemaValidationResult[] _results = null!;
    Exception? _exception;

    void Establish()
    {
        var schema = Encoding.UTF8.GetBytes($$"""{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{SchemaId}}","type":"integer"}""");
        _resourceSet = SchemaResourceSet.Load([new(SchemaId, schema)]).ResourceSet!;
    }

    void Because()
    {
        _results = new SchemaValidationResult[ConsumerCount];
        _exception = Catch.Exception(() =>
        {
            using var ready = new CountdownEvent(ConsumerCount);
            using var start = new ManualResetEventSlim();
            var consumers = Enumerable.Range(0, ConsumerCount)
                .Select(index => Task.Factory.StartNew(
                    () =>
                    {
                        ready.Signal();
                        start.Wait();
                        _results[index] = _resourceSet.Validate(SchemaId, "42"u8);
                    },
                    CancellationToken.None,
                    TaskCreationOptions.LongRunning,
                    TaskScheduler.Default))
                .ToArray();
            ready.Wait();
            start.Set();
            Task.WaitAll(consumers);
        });
    }

    [Fact] void should_not_throw() => _exception.ShouldBeNull();
    [Fact] void should_return_valid_for_every_consumer() => _results.All(_ => _.Status == SchemaValidationStatus.Valid).ShouldBeTrue();
    [Fact] void should_preserve_one_schema_set_identity() => _results.Select(_ => _.SchemaSetIdentity).Distinct().Count().ShouldEqual(1);
    [Fact] void should_preserve_one_closure() => _results.Select(_ => _.Closure).Distinct().Count().ShouldEqual(1);
    [Fact] void should_not_return_diagnostics() => _results.SelectMany(_ => _.Diagnostics).ShouldBeEmpty();
}
