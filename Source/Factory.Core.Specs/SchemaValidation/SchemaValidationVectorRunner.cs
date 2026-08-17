// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation.Conformance;

static class SchemaValidationVectorRunner
{
    static readonly JsonSerializerOptions _serializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static IReadOnlyList<string> Execute(SchemaValidationVectorManifest manifest)
    {
        var failures = new List<string>();
        foreach (var vector in manifest.Cases)
        {
            Execute(vector, manifest, failures);
        }

        return failures;
    }

    public static SchemaValidationVectorExpected Observe(SchemaValidationVectorManifest manifest, SchemaValidationVector vector)
    {
        var inputs = SchemaValidationVectorInput.CreateSchemaDocuments(manifest, vector);
        var documents = inputs.Select(_ => new SchemaDocument(_.LogicalId, _.Utf8)).ToArray();
        var loadResult = SchemaResourceSet.Load(documents);
        SchemaValidationResult? validationResult = null;
        if (loadResult.Status == SchemaLoadStatus.Loaded && string.Equals(vector.Operation, "validate", StringComparison.Ordinal))
        {
            validationResult = loadResult.ResourceSet!.Validate(vector.RootSchemaId, SchemaValidationVectorInput.CreateInstance(vector));
        }

        return Project(loadResult, validationResult);
    }

    static void Execute(SchemaValidationVector vector, SchemaValidationVectorManifest manifest, List<string> failures)
    {
        try
        {
            var expected = Serialize(vector.Expected);
            string? first = null;
            for (var iteration = 0; iteration < vector.RepeatCount; iteration++)
            {
                var actual = Serialize(Observe(manifest, vector));
                first ??= actual;
                if (!string.Equals(first, actual, StringComparison.Ordinal))
                {
                    failures.Add($"{vector.Id}: iteration {iteration + 1} was not deterministic.");
                }

                if (!string.Equals(expected, actual, StringComparison.Ordinal))
                {
                    failures.Add($"{vector.Id}: material result differed from the manifest.");
                }

                VerifyForbiddenSubstrings(vector, actual, failures);
            }

            var parallel = new string[vector.ParallelCount];
            Parallel.For(0, parallel.Length, index => parallel[index] = Serialize(Observe(manifest, vector)));
            if (parallel.Any(_ => !string.Equals(first, _, StringComparison.Ordinal)))
            {
                failures.Add($"{vector.Id}: parallel execution was not deterministic.");
            }
        }
        catch (Exception error)
        {
            failures.Add($"{vector.Id}: unexpected {error.GetType().Name}.");
        }
    }

    static SchemaValidationVectorExpected Project(SchemaLoadResult loadResult, SchemaValidationResult? validationResult)
    {
        var resourceSet = loadResult.ResourceSet;
        var diagnostics = validationResult?.Diagnostics ?? loadResult.Diagnostics;
        return new(
            loadResult.Status.ToString(),
            resourceSet is null
                ? null
                : new(
                    resourceSet.Identity.Value,
                    [.. resourceSet.Documents.Select(Project)],
                    [.. resourceSet.Resources.Select(Project)],
                    resourceSet.Resources.Count,
                    resourceSet.AnchorCount,
                    resourceSet.ReferenceCount),
            validationResult?.Status.ToString(),
            Project(validationResult?.Closure),
            [.. diagnostics.Select(Project)]);
    }

    static SchemaValidationVectorClosure? Project(SchemaClosure? closure) => closure is null
        ? null
        : new(
            closure.RootSchemaId,
            closure.Identity.Value,
            [.. closure.Members.Select(Project)],
            closure.ResourceCount,
            closure.AnchorCount,
            closure.ReferenceCount);

    static SchemaValidationVectorMember Project(SchemaClosureMember member) =>
        new(member.SchemaId, member.ContentHash.Value, member.ReferenceCount);

    static SchemaValidationVectorMember Project(SchemaDocumentDescriptor document) =>
        new(document.SchemaId, document.ContentHash.Value, document.ReferenceCount);

    static SchemaValidationVectorResource Project(SchemaResourceDescriptor resource) =>
        new(resource.SchemaId, resource.DocumentId, resource.ContentHash.Value, resource.ReferenceCount);

    static SchemaValidationVectorDiagnostic Project(SchemaDiagnostic diagnostic) =>
        new(
            diagnostic.Code.ToString(),
            diagnostic.Severity.ToString(),
            diagnostic.Status.ToString(),
            diagnostic.SchemaId,
            diagnostic.InstanceLocation,
            diagnostic.KeywordLocation);

    static string Serialize(SchemaValidationVectorExpected expected) => JsonSerializer.Serialize(expected, _serializerOptions);

    static void VerifyForbiddenSubstrings(SchemaValidationVector vector, string projection, List<string> failures)
    {
        foreach (var forbidden in vector.ForbiddenDiagnosticSubstrings)
        {
            if (projection.Contains(forbidden, StringComparison.OrdinalIgnoreCase))
            {
                failures.Add($"{vector.Id}: stable projection contained a forbidden substring.");
            }
        }
    }
}
