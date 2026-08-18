// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.SchemaValidation.Conformance;

namespace Cratis.Factory.for_SchemaValidation;

public class when_loading_and_validating_the_committed_corpus : Specification
{
    IReadOnlyList<byte[]> _schemaBytes = null!;
    IReadOnlyList<string> _schemaIds = null!;
    SchemaLoadResult _loadResult = null!;
    IReadOnlyList<string> _failures = null!;

    void Establish()
    {
        _schemaBytes = CommittedSchemaCorpus.LoadSchemaDocuments();
        _schemaIds = [.. _schemaBytes.Select(GetSchemaId)];
    }

    void Because()
    {
        _loadResult = SchemaResourceSet.Load(_schemaBytes.Zip(_schemaIds, (bytes, id) => new SchemaDocument(id, bytes)));
        var failures = new List<string>();
        if (_loadResult.ResourceSet is not null)
        {
            foreach (var instance in CommittedSchemaCorpus.Instances)
            {
                var result = _loadResult.ResourceSet.Validate(instance.SchemaId, CommittedSchemaCorpus.ReadInstance(instance));
                if (result.Status != SchemaValidationStatus.Valid)
                {
                    failures.Add($"{instance.RelativePath}: {result.Status} [{string.Join(',', result.Diagnostics.Select(_ => _.Code))}]");
                }
            }
        }

        _failures = failures;
    }

    [Fact] void should_load_all_committed_schemas() => _schemaBytes.Count.ShouldEqual(29);
    [Fact] void should_route_all_committed_instances_explicitly() => CommittedSchemaCorpus.Instances.Count.ShouldEqual(30);
    [Fact] void should_accept_the_schema_resource_set() => _loadResult.Status.ShouldEqual(SchemaLoadStatus.Loaded);
    [Fact] void should_report_no_schema_diagnostics() => _loadResult.Diagnostics.ShouldBeEmpty();
    [Fact] void should_bind_the_schema_set_identity() => _loadResult.ResourceSet!.Identity.Value.ShouldEqual("sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99");
    [Fact] void should_load_every_top_level_document() => _loadResult.ResourceSet!.Documents.Count.ShouldEqual(29);
    [Fact] void should_load_every_schema_resource() => _loadResult.ResourceSet!.Resources.Count.ShouldEqual(29);
    [Fact] void should_count_every_reference() => _loadResult.ResourceSet!.ReferenceCount.ShouldEqual(369);
    [Fact] void should_find_no_anchors() => _loadResult.ResourceSet!.AnchorCount.ShouldEqual(0);
    [Fact] void should_retain_every_exact_schema_identifier() => _loadResult.ResourceSet!.Documents.Select(_ => _.SchemaId).SequenceEqual(_schemaIds.Order(StringComparer.Ordinal), StringComparer.Ordinal).ShouldBeTrue();
    [Fact] void should_validate_every_committed_instance() => _failures.ShouldBeEmpty();

    static string GetSchemaId(byte[] utf8)
    {
        var canonical = CanonicalJson.Parse(utf8);
        return canonical.RootElement.GetProperty("$id").GetString()!;
    }
}
