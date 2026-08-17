// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.SchemaValidationParity;

sealed record ParityObservation(
    string LoadStatus,
    ParitySchemaSet? SchemaSet,
    string? ValidationStatus,
    ParitySchemaClosure? Closure,
    IReadOnlyList<ParityDiagnostic> Diagnostics,
    bool RepeatDeterministic,
    bool ParallelDeterministic)
{
    public static ParityObservation ObserveNative(
        IReadOnlyList<VectorSchemaDocument> sourceDocuments,
        string? rootSchemaId,
        byte[]? instance,
        int repeatCount,
        int parallelCount)
    {
        var first = ObserveNativeOnce(sourceDocuments, rootSchemaId, instance);
        var repeatDeterministic = true;
        for (var iteration = 1; iteration < repeatCount; iteration++)
        {
            repeatDeterministic &= MaterialEquals(first, ObserveNativeOnce(sourceDocuments, rootSchemaId, instance));
        }

        var parallel = new ParityObservation[parallelCount];
        Parallel.For(0, parallelCount, index => parallel[index] = ObserveNativeOnce(sourceDocuments, rootSchemaId, instance));
        var parallelDeterministic = parallel.All(_ => MaterialEquals(first, _));
        return first with
        {
            RepeatDeterministic = repeatDeterministic,
            ParallelDeterministic = parallelDeterministic
        };
    }

    public static ParityObservation FromOracle(OracleResponse response) => new(
        response.LoadStatus!,
        response.SchemaSet is null ? null : new(
            response.SchemaSet.Identity!,
            [.. response.SchemaSet.Documents!.Select(ToMember)],
            [.. response.SchemaSet.Resources!.Select(ToResource)],
            response.SchemaSet.ResourceCount!.Value,
            response.SchemaSet.AnchorCount!.Value,
            response.SchemaSet.ReferenceCount!.Value),
        response.ValidationStatus,
        response.Closure is null ? null : new(
            response.Closure.RootSchemaId!,
            response.Closure.Identity!,
            [.. response.Closure.Members!.Select(ToMember)],
            response.Closure.ResourceCount!.Value,
            response.Closure.AnchorCount!.Value,
            response.Closure.ReferenceCount!.Value),
        [.. response.Diagnostics!.Select(ToDiagnostic)],
        response.RepeatDeterministic!.Value,
        response.ParallelDeterministic!.Value);

    static ParityObservation ObserveNativeOnce(
        IReadOnlyList<VectorSchemaDocument> sourceDocuments,
        string? rootSchemaId,
        byte[]? instance)
    {
        var documents = sourceDocuments.Select(_ => new SchemaDocument(_.LogicalId, _.Utf8)).ToArray();
        var load = SchemaResourceSet.Load(documents);
        if (load.ResourceSet is null)
        {
            return new(
                load.Status.ToString(),
                null,
                null,
                null,
                [.. load.Diagnostics.Select(ToDiagnostic)],
                false,
                false);
        }

        var set = load.ResourceSet;
        var projectedSet = new ParitySchemaSet(
            set.Identity.Value,
            [.. set.Documents.Select(_ => new ParitySchemaMember(_.SchemaId, _.ContentHash.Value, _.ReferenceCount))],
            [.. set.Resources.Select(_ => new ParitySchemaResource(_.SchemaId, _.DocumentId, _.ContentHash.Value, _.ReferenceCount))],
            set.Resources.Count,
            set.AnchorCount,
            set.ReferenceCount);
        if (rootSchemaId is null || instance is null)
        {
            return new(load.Status.ToString(), projectedSet, null, null, [], false, false);
        }

        var validation = set.Validate(rootSchemaId, instance);
        return new(
            load.Status.ToString(),
            projectedSet,
            validation.Status.ToString(),
            validation.Closure is null ? null : new(
                validation.Closure.RootSchemaId,
                validation.Closure.Identity.Value,
                [.. validation.Closure.Members.Select(_ => new ParitySchemaMember(_.SchemaId, _.ContentHash.Value, _.ReferenceCount))],
                validation.Closure.ResourceCount,
                validation.Closure.AnchorCount,
                validation.Closure.ReferenceCount),
            [.. validation.Diagnostics.Select(ToDiagnostic)],
            false,
            false);
    }

    static ParitySchemaMember ToMember(OracleSchemaMember member) =>
        new(member.SchemaId!, member.ContentHash!, member.ReferenceCount!.Value);

    static ParitySchemaResource ToResource(OracleSchemaResource resource) =>
        new(resource.SchemaId!, resource.DocumentId!, resource.ContentHash!, resource.ReferenceCount!.Value);

    static ParityDiagnostic ToDiagnostic(OracleDiagnostic diagnostic) => new(
        diagnostic.Code!,
        diagnostic.Severity!,
        diagnostic.Status!,
        diagnostic.SchemaId,
        diagnostic.InstanceLocation!,
        diagnostic.KeywordLocation!);

    static ParityDiagnostic ToDiagnostic(SchemaDiagnostic diagnostic) => new(
        diagnostic.Code.ToString(),
        diagnostic.Severity.ToString(),
        diagnostic.Status.ToString(),
        diagnostic.SchemaId,
        diagnostic.InstanceLocation,
        diagnostic.KeywordLocation);

    static bool MaterialEquals(ParityObservation left, ParityObservation right)
    {
        var leftMaterial = left with { RepeatDeterministic = false, ParallelDeterministic = false };
        var rightMaterial = right with { RepeatDeterministic = false, ParallelDeterministic = false };
        return string.Equals(
            JsonSerializer.Serialize(leftMaterial, ParityJson.Options),
            JsonSerializer.Serialize(rightMaterial, ParityJson.Options),
            StringComparison.Ordinal);
    }
}

sealed record ParitySchemaSet(
    string Identity,
    IReadOnlyList<ParitySchemaMember> Documents,
    IReadOnlyList<ParitySchemaResource> Resources,
    int ResourceCount,
    int AnchorCount,
    int ReferenceCount);

sealed record ParitySchemaClosure(
    string RootSchemaId,
    string Identity,
    IReadOnlyList<ParitySchemaMember> Members,
    int ResourceCount,
    int AnchorCount,
    int ReferenceCount);

sealed record ParitySchemaMember(string SchemaId, string ContentHash, int ReferenceCount);

sealed record ParitySchemaResource(string SchemaId, string DocumentId, string ContentHash, int ReferenceCount);

sealed record ParityDiagnostic(
    string Code,
    string Severity,
    string Status,
    string? SchemaId,
    string InstanceLocation,
    string KeywordLocation);
