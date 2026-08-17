// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ComponentModel;
using System.Text.Json;

namespace Cratis.Factory.SchemaValidationParity;

static class ParityRunner
{
    public static ParitySummary Run(ParityConfiguration configuration)
    {
        try
        {
            return RunCore(configuration);
        }
        catch (Exception error) when (error is
            IOException or
            UnauthorizedAccessException or
            JsonException or
            FormatException or
            Win32Exception or
            AggregateException or
            InvalidVectorManifest or
            InvalidMigrationEnvironment or
            Cratis.Factory.Canonicalization.InvalidCanonicalJson)
        {
            return ParitySummary.EnvironmentFailure(error);
        }
    }

    static ParitySummary RunCore(ParityConfiguration configuration)
    {
        var vectorPath = Path.Combine(
            configuration.RepositoryRoot,
            "Factory",
            "Fixtures",
            "Contracts",
            "v1",
            "schema-validation-vectors.json");
        var (manifest, vectors) = VectorManifestLoader.Load(File.ReadAllBytes(vectorPath));
        var comparisons = new ComparisonTracker();
        var loadedCount = 0;

        using var oracle = new PythonOracle(configuration.PythonExecutable, configuration.RepositoryRoot);
        for (var ordinal = 0; ordinal < vectors.Length; ordinal++)
        {
            var vector = vectors[ordinal];
            var documents = VectorInputGenerator.CreateSchemaDocuments(manifest, vector);
            var instance = VectorInputGenerator.CreateInstance(vector);
            var native = ParityObservation.ObserveNative(
                documents,
                vector.RootSchemaId,
                instance,
                vector.RepeatCount!.Value,
                vector.ParallelCount!.Value);
            var python = ParityObservation.FromOracle(oracle.Evaluate(
                documents.Select(_ => new OracleSchemaDocument(_.LogicalId, Convert.ToBase64String(_.Utf8))),
                vector.RootSchemaId,
                instance,
                vector.RepeatCount.Value,
                vector.ParallelCount.Value));

            Compare(native, python, ordinal, comparisons);
            Compare(vector.Expected!, native, ordinal, comparisons);
            Compare(vector.Expected!, python, ordinal, comparisons);
            comparisons.Check(true, native.RepeatDeterministic, ordinal);
            comparisons.Check(true, native.ParallelDeterministic, ordinal);
            comparisons.Check(true, python.RepeatDeterministic, ordinal);
            comparisons.Check(true, python.ParallelDeterministic, ordinal);
            CompareForbiddenSubstrings(vector, native, ordinal, comparisons);
            CompareForbiddenSubstrings(vector, python, ordinal, comparisons);
            if (vector.Expected!.LoadStatus == "Loaded") loadedCount++;
        }

        return new(
            manifest.ProtocolVersion!,
            "temporary-schema-validation-parity",
            comparisons.FailedCount == 0 ? "success" : "parity-failed",
            manifest.ContentHash,
            vectors.Length,
            loadedCount,
            vectors.Length - loadedCount,
            comparisons.Count,
            comparisons.FailedCount,
            [.. comparisons.FailedCaseOrdinals],
            "temporary-python-jsonschema-oracle",
            null,
            comparisons.FailedCount == 0 ? 0 : 1);
    }

    static void Compare(ParityObservation expected, ParityObservation actual, int ordinal, ComparisonTracker comparisons)
    {
        comparisons.Check(expected.LoadStatus, actual.LoadStatus, ordinal);
        Compare(expected.SchemaSet, actual.SchemaSet, ordinal, comparisons);
        comparisons.Check(expected.ValidationStatus, actual.ValidationStatus, ordinal);
        Compare(expected.Closure, actual.Closure, ordinal, comparisons);
        comparisons.CheckSequence(expected.Diagnostics, actual.Diagnostics, ordinal);
        comparisons.Check(expected.RepeatDeterministic, actual.RepeatDeterministic, ordinal);
        comparisons.Check(expected.ParallelDeterministic, actual.ParallelDeterministic, ordinal);
    }

    static void Compare(VectorExpected expected, ParityObservation actual, int ordinal, ComparisonTracker comparisons)
    {
        comparisons.Check(expected.LoadStatus, actual.LoadStatus, ordinal);
        Compare(expected.SchemaSet, actual.SchemaSet, ordinal, comparisons);
        comparisons.Check(expected.ValidationStatus, actual.ValidationStatus, ordinal);
        Compare(expected.Closure, actual.Closure, ordinal, comparisons);
        comparisons.CheckSequence(
            expected.Diagnostics!.Select(_ => new ParityDiagnostic(
                _!.Code!,
                _.Severity!,
                _.Status!,
                _.SchemaId,
                _.InstanceLocation!,
                _.KeywordLocation!)),
            actual.Diagnostics,
            ordinal);
    }

    static void Compare(ParitySchemaSet? expected, ParitySchemaSet? actual, int ordinal, ComparisonTracker comparisons)
    {
        comparisons.Check(expected is null, actual is null, ordinal);
        if (expected is null || actual is null) return;
        comparisons.Check(expected.Identity, actual.Identity, ordinal);
        comparisons.CheckSequence(expected.Documents, actual.Documents, ordinal);
        comparisons.CheckSequence(expected.Resources, actual.Resources, ordinal);
        comparisons.Check(expected.ResourceCount, actual.ResourceCount, ordinal);
        comparisons.Check(expected.AnchorCount, actual.AnchorCount, ordinal);
        comparisons.Check(expected.ReferenceCount, actual.ReferenceCount, ordinal);
    }

    static void Compare(VectorSet? expected, ParitySchemaSet? actual, int ordinal, ComparisonTracker comparisons)
    {
        comparisons.Check(expected is null, actual is null, ordinal);
        if (expected is null || actual is null) return;
        comparisons.Check(expected.Identity, actual.Identity, ordinal);
        comparisons.CheckSequence(
            expected.Documents!.Select(_ => new ParitySchemaMember(_!.SchemaId!, _.ContentHash!, _.ReferenceCount!.Value)),
            actual.Documents,
            ordinal);
        comparisons.CheckSequence(
            expected.Resources!.Select(_ => new ParitySchemaResource(_!.SchemaId!, _.DocumentId!, _.ContentHash!, _.ReferenceCount!.Value)),
            actual.Resources,
            ordinal);
        comparisons.Check(expected.ResourceCount!.Value, actual.ResourceCount, ordinal);
        comparisons.Check(expected.AnchorCount!.Value, actual.AnchorCount, ordinal);
        comparisons.Check(expected.ReferenceCount!.Value, actual.ReferenceCount, ordinal);
    }

    static void Compare(ParitySchemaClosure? expected, ParitySchemaClosure? actual, int ordinal, ComparisonTracker comparisons)
    {
        comparisons.Check(expected is null, actual is null, ordinal);
        if (expected is null || actual is null) return;
        comparisons.Check(expected.RootSchemaId, actual.RootSchemaId, ordinal);
        comparisons.Check(expected.Identity, actual.Identity, ordinal);
        comparisons.CheckSequence(expected.Members, actual.Members, ordinal);
        comparisons.Check(expected.ResourceCount, actual.ResourceCount, ordinal);
        comparisons.Check(expected.AnchorCount, actual.AnchorCount, ordinal);
        comparisons.Check(expected.ReferenceCount, actual.ReferenceCount, ordinal);
    }

    static void Compare(VectorClosure? expected, ParitySchemaClosure? actual, int ordinal, ComparisonTracker comparisons)
    {
        comparisons.Check(expected is null, actual is null, ordinal);
        if (expected is null || actual is null) return;
        comparisons.Check(expected.RootSchemaId, actual.RootSchemaId, ordinal);
        comparisons.Check(expected.Identity, actual.Identity, ordinal);
        comparisons.CheckSequence(
            expected.Members!.Select(_ => new ParitySchemaMember(_!.SchemaId!, _.ContentHash!, _.ReferenceCount!.Value)),
            actual.Members,
            ordinal);
        comparisons.Check(expected.ResourceCount!.Value, actual.ResourceCount, ordinal);
        comparisons.Check(expected.AnchorCount!.Value, actual.AnchorCount, ordinal);
        comparisons.Check(expected.ReferenceCount!.Value, actual.ReferenceCount, ordinal);
    }

    static void CompareForbiddenSubstrings(
        VectorCase vector,
        ParityObservation observation,
        int ordinal,
        ComparisonTracker comparisons)
    {
        var serialized = JsonSerializer.Serialize(observation.Diagnostics, ParityJson.Options);
        foreach (var forbidden in vector.ForbiddenDiagnosticSubstrings!)
        {
            comparisons.Check(false, serialized.Contains(forbidden, StringComparison.OrdinalIgnoreCase), ordinal);
        }
    }
}
