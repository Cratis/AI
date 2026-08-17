// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections;
using System.Security.Cryptography;
using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Definitions;
using Cratis.Factory.Hashing;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.DefinitionWorkflowCompilation;

public static class DefinitionWorkflowCorpusRunner
{
    const string ExpectedSelfHash = "sha256:6387a2604e255c684fae1521ccf638e93f2a6596f202254a920564e850b8e2d5";

    public static DefinitionWorkflowCorpusRun Run(
        ReadOnlySpan<byte> corpusUtf8,
        IReadOnlyDictionary<string, byte[]> callerAssets)
    {
        var failures = new List<string>();
        try
        {
            var assets = callerAssets.ToDictionary(_ => _.Key, _ => _.Value.ToArray(), StringComparer.Ordinal);
            var corpus = Load(corpusUtf8, assets);
            Execute(corpus, failures);
            return new(corpus.NativeComparisons, [.. failures], [.. corpus.Observations]);
        }
        catch (Exception error) when (error is not OutOfMemoryException and not StackOverflowException and not AccessViolationException)
        {
            failures.Add("corpus: strict loading failed closed");
            return new(0, [.. failures], []);
        }
    }

    public static DefinitionWorkflowCorpusPreparation Prepare(
        ReadOnlySpan<byte> corpusUtf8,
        IReadOnlyDictionary<string, byte[]> callerAssets)
    {
        try
        {
            var assets = callerAssets.ToDictionary(_ => _.Key, _ => _.Value.ToArray(), StringComparer.Ordinal);
            var corpus = Load(corpusUtf8, assets);
            return new([.. corpus.Observations], []);
        }
        catch (Exception error) when (error is not OutOfMemoryException and not StackOverflowException and not AccessViolationException)
        {
            return new([], ["corpus: strict loading failed closed"]);
        }
    }

    static LoadedCorpus Load(ReadOnlySpan<byte> utf8, IReadOnlyDictionary<string, byte[]> assets)
    {
        if (!CanonicalJson.TryParse(utf8, out var canonical, out _)) throw new InvalidDefinitionWorkflowCorpus();
        var verification = CanonicalJsonSelfHash.Verify(canonical, CanonicalJsonSelfHashField.ContentHash);
        if (verification.Status is not CanonicalJsonSelfHashVerificationStatus.Verified || verification.Actual!.Value != ExpectedSelfHash)
        {
            throw new InvalidDefinitionWorkflowCorpus();
        }

        var root = canonical.RootElement;
        RequireMembers(root, "protocolVersion", "documentKind", "algorithm", "description", "contentHash", "stage0OracleSnapshot", "acceptedSchemaSet", "limits", "schemaRoutes", "definitionArtifacts", "stage0Mappings", "generators", "cases", "comparisonContract", "declaredCounts");
        RequireString(root, "protocolVersion", "1");
        RequireString(root, "documentKind", "definition-workflow-compilation-contract-corpus");
        RequireString(root, "algorithm", "factory-definition-workflow-compilation-corpus-v1");
        ValidateFixedShapes(root);
        ValidateIdentifiersAndAssets(root, assets);

        var acceptedElement = root.GetProperty("acceptedSchemaSet");
        var schemaDocuments = new List<SchemaDocument>();
        foreach (var schema in acceptedElement.GetProperty("schemas").EnumerateArray())
        {
            var asset = VerifyAsset(schema, assets);
            schemaDocuments.Add(new(schema.GetProperty("schemaId").GetString(), asset));
        }
        var load = SchemaResourceSet.Load(schemaDocuments);
        if (load.Status is not SchemaLoadStatus.Loaded) throw new InvalidDefinitionWorkflowCorpus();
        var schemas = load.ResourceSet!;
        RejectIf(schemas.Identity.Value != acceptedElement.GetProperty("identity").GetString() ||
            schemas.Documents.Count != acceptedElement.GetProperty("documentCount").GetInt32() ||
            schemas.Resources.Count != acceptedElement.GetProperty("resourceCount").GetInt32() ||
            schemas.ReferenceCount != acceptedElement.GetProperty("referenceCount").GetInt32() ||
            schemas.AnchorCount != acceptedElement.GetProperty("anchorCount").GetInt32());
        foreach (var schema in acceptedElement.GetProperty("schemas").EnumerateArray())
        {
            var schemaId = schema.GetProperty("schemaId").GetString();
            var closure = schemas.GetClosure(schemaId).Closure;
            var document = schemas.Documents.Single(_ => _.SchemaId == schemaId);
            RejectIf(closure is null || closure.Identity.Value != schema.GetProperty("closureIdentity").GetString() ||
                document.ReferenceCount != schema.GetProperty("referenceCount").GetInt32());
        }

        var artifacts = new Dictionary<string, DefinitionAsset>(StringComparer.Ordinal);
        foreach (var artifact in root.GetProperty("definitionArtifacts").EnumerateArray())
        {
            var bytes = VerifyAsset(artifact, assets);
            var id = artifact.GetProperty("id").GetString()!;
            if (!artifacts.TryAdd(id, new(
                artifact.GetProperty("logicalId").GetString()!,
                Kind(artifact.GetProperty("kind").GetString()!),
                bytes)))
            {
                throw new InvalidDefinitionWorkflowCorpus();
            }
        }

        ValidateRoutes(root, schemas);
        var observations = new List<DefinitionWorkflowCorpusObservation>();
        var artifactDescriptor = artifacts["definition-artifact-descriptor-example"].Bytes;
        foreach (var item in root.GetProperty("cases").EnumerateArray())
        {
            var definitions = item.TryGetProperty("generatedInput", out var generated)
                ? DefinitionWorkflowCorpusGenerator.Generate(
                    generated.GetProperty("generator").GetString()!,
                    GeneratorBoundary(root, generated),
                    artifactDescriptor)
                : ReadDefinitions(item.GetProperty("definitions"), artifacts);
            var schemaSet = SchemaInput(item.GetProperty("schemaSetInput"), schemas, schemaDocuments);
            observations.Add(new(
                item.GetProperty("id").GetString()!,
                item.GetProperty("workflowId").GetString(),
                schemaSet,
                definitions,
                NullableInt(item.GetProperty("enumerationFailureAfter")),
                item.GetProperty("expected").Clone(),
                item.GetProperty("stage0Expected").Clone(),
                true));
        }
        foreach (var generator in root.GetProperty("generators").EnumerateArray())
        {
            var id = generator.GetProperty("id").GetString()!;
            foreach (var boundary in new[] { "maximum", "maximumPlusOne" })
            {
                observations.Add(new(
                    $"{id}/{boundary}",
                    GeneratorWorkflowId(id),
                    schemas,
                    DefinitionWorkflowCorpusGenerator.Generate(id, generator.GetProperty(boundary).GetInt32(), artifactDescriptor),
                    null,
                    generator.GetProperty(boundary == "maximum" ? "maximumExpected" : "maximumPlusOneExpected").Clone(),
                    generator.GetProperty(boundary == "maximum" ? "maximumStage0Expected" : "maximumPlusOneStage0Expected").Clone(),
                    false));
            }
        }
        return new(root.Clone(), observations, 0);
    }

    static void Execute(LoadedCorpus corpus, List<string> failures)
    {
        var comparisons = 0;
        var baseResults = new Dictionary<string, DefinitionCompilationResult>(StringComparer.Ordinal);
        foreach (var observation in corpus.Observations)
        {
            var result = Observe(observation);
            baseResults[observation.Id] = result;
            CompareExpected(observation.Id, observation.Expected, result, failures, ref comparisons);
        }

        foreach (var observation in corpus.Observations.Where(_ => _.IsCase))
        {
            var baseline = baseResults[observation.Id];
            for (var repeat = 0; repeat < 2; repeat++)
            {
                CompareBundles(observation.Id, baseline, Observe(observation), failures, ref comparisons);
            }
        }

        var parallelObservation = corpus.Observations.Single(_ => _.Id == "route-workflow");
        var parallelResults = new DefinitionCompilationResult[128];
        Parallel.For(0, parallelResults.Length, new ParallelOptions { MaxDegreeOfParallelism = 8 }, index => parallelResults[index] = Observe(parallelObservation));
        foreach (var result in parallelResults)
        {
            CompareBundles("route-workflow/parallel", baseResults["route-workflow"], result, failures, ref comparisons);
        }
        corpus.NativeComparisons = comparisons;
        if (comparisons != 1864) failures.Add($"corpus: native comparison count was {comparisons}");
    }

    static DefinitionCompilationResult Observe(DefinitionWorkflowCorpusObservation observation)
    {
        IEnumerable<DefinitionDocument> definitions = observation.Definitions;
        if (observation.EnumerationFailureAfter.HasValue)
        {
            definitions = new ThrowingDefinitions(definitions, observation.EnumerationFailureAfter.Value);
        }
        return DefinitionCompiler.Compile(observation.Schemas, definitions, observation.WorkflowId);
    }

    static void CompareExpected(
        string id,
        JsonElement expected,
        DefinitionCompilationResult actual,
        List<string> failures,
        ref int comparisons)
    {
        Compare(id, "status", Token(actual.Status), expected.GetProperty("status").GetString(), failures, ref comparisons);
        Compare(id, "schema-set identity", actual.SchemaSetIdentity?.Value, NullableString(expected.GetProperty("schemaSetIdentity")), failures, ref comparisons);
        Compare(id, "definition-set identity", actual.DefinitionSetIdentity?.Value, NullableString(expected.GetProperty("definitionSetIdentity")), failures, ref comparisons);
        Compare(id, "descriptors", Descriptors(actual), ExpectedDescriptors(expected), failures, ref comparisons);
        Compare(id, "workflow ID", actual.WorkflowId, expected.GetProperty("workflowId").GetString(), failures, ref comparisons);
        Compare(id, "source content hash", actual.Workflow?.SourceContentHash.Value, NullableString(expected.GetProperty("sourceContentHash")), failures, ref comparisons);
        Compare(id, "normalized bytes", actual.Workflow is null ? null : Convert.ToBase64String(actual.Workflow.Utf8), NullableString(expected.GetProperty("normalizedBase64")), failures, ref comparisons);
        Compare(id, "normalized whole hash", actual.Workflow is null ? null : Sha256Hash.Calculate(actual.Workflow.Utf8).Value, NullableString(expected.GetProperty("normalizedHash")), failures, ref comparisons);
        Compare(id, "diagnostics", Diagnostics(actual), ExpectedDiagnostics(expected), failures, ref comparisons);
        Compare(id, "diagnostic count", actual.Diagnostics.Count.ToString(), expected.GetProperty("diagnosticCount").GetInt32().ToString(), failures, ref comparisons);
    }

    static void CompareBundles(
        string id,
        DefinitionCompilationResult expected,
        DefinitionCompilationResult actual,
        List<string> failures,
        ref int comparisons)
    {
        Compare(id, "outcome/identities", $"{expected.Status}|{expected.SchemaSetIdentity}|{expected.DefinitionSetIdentity}", $"{actual.Status}|{actual.SchemaSetIdentity}|{actual.DefinitionSetIdentity}", failures, ref comparisons);
        Compare(id, "descriptors", Descriptors(expected), Descriptors(actual), failures, ref comparisons);
        Compare(id, "workflow/bytes/hashes", WorkflowBundle(expected), WorkflowBundle(actual), failures, ref comparisons);
        Compare(id, "diagnostics/count", $"{Diagnostics(expected)}|{expected.Diagnostics.Count}", $"{Diagnostics(actual)}|{actual.Diagnostics.Count}", failures, ref comparisons);
    }

    static void Compare(string id, string field, string? actual, string? expected, List<string> failures, ref int comparisons)
    {
        comparisons++;
        if (!string.Equals(actual, expected, StringComparison.Ordinal)) failures.Add($"{id}: {field} differed");
    }

    static string Descriptors(DefinitionCompilationResult result) => string.Join('\n', result.Definitions.Select(_ => $"{_.LogicalId}|{(int)_.Kind}|{_.SchemaId}|{_.SchemaClosureIdentity}|{_.ContentHash}"));
    static string ExpectedDescriptors(JsonElement result) => string.Join('\n', result.GetProperty("descriptors").EnumerateArray().Select(_ => $"{_.GetProperty("logicalId").GetString()}|{_.GetProperty("kindValue").GetInt32()}|{_.GetProperty("schemaId").GetString()}|{_.GetProperty("schemaClosureIdentity").GetString()}|{_.GetProperty("contentHash").GetString()}"));
    static string Diagnostics(DefinitionCompilationResult result) => string.Join('\n', result.Diagnostics.Select(_ => $"{(int)_.Code}|{_.Severity}|{_.Status}|{_.LogicalId}|{_.Location}|{_.RelatedId}|{_.CanonicalCode}|{_.SchemaCode}"));
    static string ExpectedDiagnostics(JsonElement result) => string.Join('\n', result.GetProperty("diagnostics").EnumerateArray().Select(_ => $"{_.GetProperty("codeValue").GetInt32()}|Error|{DiagnosticStatus(_.GetProperty("status").GetString()!)}|{_.GetProperty("logicalId").GetString()}|{_.GetProperty("location").GetString()}|{_.GetProperty("relatedId").GetString()}|{NullableString(_.GetProperty("canonicalCode"))}|{NullableString(_.GetProperty("schemaCode"))}"));
    static string WorkflowBundle(DefinitionCompilationResult result) => result.Workflow is null
        ? string.Empty
        : $"{result.Workflow.Id}|{result.Workflow.SourceContentHash}|{result.Workflow.ContentHash}|{Convert.ToBase64String(result.Workflow.Utf8)}|{Sha256Hash.Calculate(result.Workflow.Utf8)}";

    static List<DefinitionDocument> ReadDefinitions(JsonElement definitions, IReadOnlyDictionary<string, DefinitionAsset> artifacts)
    {
        var values = new List<DefinitionDocument>();
        foreach (var definition in definitions.EnumerateArray())
        {
            if (definition.TryGetProperty("nullElement", out _))
            {
                values.Add(null!);
                continue;
            }
            var logicalId = definition.GetProperty("logicalId").GetString();
            var kind = Kind(definition.GetProperty("kind").GetString()!);
            byte[] bytes;
            if (definition.TryGetProperty("artifact", out var artifact))
            {
                bytes = artifacts[artifact.GetString()!].Bytes;
            }
            else
            {
                bytes = Convert.FromBase64String(definition.GetProperty("inlineBase64").GetString()!);
                VerifyInline(definition, bytes);
            }
            values.Add(new(logicalId, kind, bytes));
        }
        return values;
    }

    static SchemaResourceSet? SchemaInput(JsonElement input, SchemaResourceSet accepted, IReadOnlyList<SchemaDocument> documents)
    {
        return input.GetProperty("mode").GetString() switch
        {
            "accepted" => accepted,
            "null" => null,
            "accepted-plus-inline" => LoadAdditional(input, documents),
            _ => throw new InvalidDefinitionWorkflowCorpus()
        };
    }

    static SchemaResourceSet LoadAdditional(JsonElement input, IReadOnlyList<SchemaDocument> documents)
    {
        var bytes = Convert.FromBase64String(input.GetProperty("inlineBase64").GetString()!);
        VerifyInline(input, bytes);
        var loaded = SchemaResourceSet.Load(documents.Append(new SchemaDocument(input.GetProperty("schemaId").GetString(), bytes)));
        if (loaded.Status is not SchemaLoadStatus.Loaded || loaded.ResourceSet!.Identity.Value != input.GetProperty("expectedIdentity").GetString()) throw new InvalidDefinitionWorkflowCorpus();
        return loaded.ResourceSet;
    }

    static byte[] VerifyAsset(JsonElement descriptor, IReadOnlyDictionary<string, byte[]> assets)
    {
        var path = descriptor.GetProperty("path").GetString()!;
        if (!assets.TryGetValue(path, out var bytes)) throw new InvalidDefinitionWorkflowCorpus();
        if (Convert.ToHexStringLower(SHA256.HashData(bytes)) != descriptor.GetProperty("rawSha256").GetString()) throw new InvalidDefinitionWorkflowCorpus();
        var expectedCanonical = NullableString(descriptor.GetProperty("canonicalHash"));
        if (expectedCanonical is null)
        {
            if (CanonicalJson.TryParse(bytes, out _, out _)) throw new InvalidDefinitionWorkflowCorpus();
        }
        else
        {
            var canonical = CanonicalJson.Parse(bytes);
            if (Sha256Hash.Calculate(canonical.Utf8).Value != expectedCanonical) throw new InvalidDefinitionWorkflowCorpus();
        }
        return [.. bytes];
    }

    static void VerifyInline(JsonElement descriptor, byte[] bytes)
    {
        if (Convert.ToHexStringLower(SHA256.HashData(bytes)) != descriptor.GetProperty("rawSha256").GetString()) throw new InvalidDefinitionWorkflowCorpus();
        var expectedCanonical = NullableString(descriptor.GetProperty("canonicalHash"));
        if (expectedCanonical is null)
        {
            if (CanonicalJson.TryParse(bytes, out _, out _)) throw new InvalidDefinitionWorkflowCorpus();
        }
        else
        {
            var canonical = CanonicalJson.Parse(bytes);
            if (Sha256Hash.Calculate(canonical.Utf8).Value != expectedCanonical) throw new InvalidDefinitionWorkflowCorpus();
        }
    }

    static void ValidateRoutes(JsonElement root, SchemaResourceSet schemas)
    {
        var seen = new HashSet<DefinitionKind>();
        foreach (var route in root.GetProperty("schemaRoutes").EnumerateArray())
        {
            var kind = Kind(route.GetProperty("kind").GetString()!);
            RejectIf((int)kind != route.GetProperty("kindValue").GetInt32() || !seen.Add(kind) ||
                !DefinitionCompiler.TryGetSchemaId(kind, out var schemaId) || schemaId != route.GetProperty("schemaId").GetString() ||
                schemas.GetClosure(schemaId).Closure!.Identity.Value != route.GetProperty("closureIdentity").GetString());
        }
        if (seen.Count != 13) throw new InvalidDefinitionWorkflowCorpus();
    }

    static void ValidateFixedShapes(JsonElement root)
    {
        var oracle = root.GetProperty("stage0OracleSnapshot");
        RequireMembers(oracle, "root", "platform", "files", "pythonInvocation", "network", "writes");
        foreach (var file in oracle.GetProperty("files").EnumerateArray()) RequireMembers(file, "path", "rawSha256", "sizeBytes");
        var counts = root.GetProperty("declaredCounts");
        RequireMembers(counts, "schemas", "schemaRoutes", "definitionArtifacts", "stage0Mappings", "stage0ApplicableObservations", "generators", "generatorBoundaryObservations", "cases", "parallelCases", "comparisonsPerConfiguration");
        RejectIf(counts.GetProperty("schemas").GetInt32() != root.GetProperty("acceptedSchemaSet").GetProperty("schemas").GetArrayLength() ||
            counts.GetProperty("schemaRoutes").GetInt32() != root.GetProperty("schemaRoutes").GetArrayLength() ||
            counts.GetProperty("definitionArtifacts").GetInt32() != root.GetProperty("definitionArtifacts").GetArrayLength() ||
            counts.GetProperty("schemas").GetInt32() != 29 || counts.GetProperty("schemaRoutes").GetInt32() != 13 ||
            counts.GetProperty("definitionArtifacts").GetInt32() != 26 || counts.GetProperty("stage0Mappings").GetInt32() != 2 ||
            counts.GetProperty("stage0ApplicableObservations").GetInt32() != 63 || counts.GetProperty("generators").GetInt32() != 10 ||
            counts.GetProperty("generatorBoundaryObservations").GetInt32() != 20 || counts.GetProperty("cases").GetInt32() != 64 ||
            counts.GetProperty("parallelCases").GetInt32() != 1 ||
            counts.GetProperty("comparisonsPerConfiguration").GetInt32() != 1990);
        RequireMembers(root.GetProperty("acceptedSchemaSet"), "identity", "documentCount", "resourceCount", "referenceCount", "anchorCount", "schemas");
        RequireMembers(root.GetProperty("limits"), "definitions", "aggregateDefinitionBytes", "definitionBytes", "retainedDefinitionBytes", "logicalIdScalars", "capabilities", "workflowInputs", "phases", "phaseInputs", "gates", "dependencyEdges", "semanticWorkUnits", "diagnostics", "normalizedBytes");
        foreach (var schema in root.GetProperty("acceptedSchemaSet").GetProperty("schemas").EnumerateArray()) RequireMembers(schema, "id", "schemaId", "path", "rawSha256", "canonicalHash", "closureIdentity", "referenceCount");
        foreach (var route in root.GetProperty("schemaRoutes").EnumerateArray()) RequireMembers(route, "kind", "kindValue", "schemaId", "closureIdentity");
        foreach (var artifact in root.GetProperty("definitionArtifacts").EnumerateArray()) RequireMembers(artifact, "id", "logicalId", "kind", "path", "rawSha256", "canonicalHash");
        foreach (var mapping in root.GetProperty("stage0Mappings").EnumerateArray()) RequireMembers(mapping, "id", "source", "observation", "outputField");
        foreach (var generator in root.GetProperty("generators").EnumerateArray())
        {
            RequireMembers(generator, "id", "algorithm", "maximum", "maximumPlusOne", "maximumExpected", "maximumPlusOneExpected", "maximumStage0Expected", "maximumPlusOneStage0Expected");
            ValidateExpected(generator.GetProperty("maximumExpected"));
            ValidateExpected(generator.GetProperty("maximumPlusOneExpected"));
            ValidateStage0(generator.GetProperty("maximumStage0Expected"));
            ValidateStage0(generator.GetProperty("maximumPlusOneStage0Expected"));
        }
        foreach (var item in root.GetProperty("cases").EnumerateArray())
        {
            string[] members = item.TryGetProperty("generatedInput", out _)
                ? ["id", "schemaSetInput", "workflowId", "definitions", "enumerationFailureAfter", "repeat", "parallel", "expected", "stage0Expected", "generatedInput"]
                : ["id", "schemaSetInput", "workflowId", "definitions", "enumerationFailureAfter", "repeat", "parallel", "expected", "stage0Expected"];
            RequireMembers(item, members);
            var schemaInput = item.GetProperty("schemaSetInput");
            RequireMembers(schemaInput, "mode", "schemaId", "inlineBase64", "rawSha256", "canonicalHash", "expectedIdentity");
            ValidateSchemaInput(schemaInput);
            if (item.TryGetProperty("generatedInput", out var generatedInput))
            {
                RequireMembers(generatedInput, "generator", "boundary");
                if (generatedInput.GetProperty("boundary").GetString() is not ("maximum" or "maximum-plus-one")) throw new InvalidDefinitionWorkflowCorpus();
            }
            ValidateExpected(item.GetProperty("expected"));
            ValidateStage0(item.GetProperty("stage0Expected"));
            foreach (var definition in item.GetProperty("definitions").EnumerateArray())
            {
                if (definition.TryGetProperty("nullElement", out _)) RequireMembers(definition, "nullElement");
                else if (definition.TryGetProperty("artifact", out _)) RequireMembers(definition, "logicalId", "kind", "artifact");
                else RequireMembers(definition, "logicalId", "kind", "inlineBase64", "rawSha256", "canonicalHash");
            }
        }
        var comparison = root.GetProperty("comparisonContract");
        RequireMembers(comparison, "nativeMaterialFields", "nativePairings", "languageNeutralObservations", "nativeBaseComparisons", "nativeRepeatCaseCount", "nativeRepeatCallsPerCase", "nativeRepeatBundles", "nativeRepeatComparisons", "nativeParallelCaseIds", "nativeParallelCallsPerCase", "nativeParallelDegree", "nativeParallelBundles", "nativeParallelComparisons", "stage0MaterialFields", "stage0Pairings", "stage0ApplicableObservations", "stage0Comparisons", "comparisonsPerConfiguration", "configurations");
        RejectIf(comparison.GetProperty("languageNeutralObservations").GetInt32() != 84 ||
            comparison.GetProperty("nativeBaseComparisons").GetInt32() != 840 ||
            comparison.GetProperty("nativeRepeatCaseCount").GetInt32() != 64 ||
            comparison.GetProperty("nativeRepeatCallsPerCase").GetInt32() != 2 ||
            comparison.GetProperty("nativeRepeatBundles").GetArrayLength() != 4 ||
            comparison.GetProperty("nativeRepeatComparisons").GetInt32() != 512 ||
            comparison.GetProperty("nativeParallelCallsPerCase").GetInt32() != 128 ||
            comparison.GetProperty("nativeParallelDegree").GetInt32() != 8 ||
            comparison.GetProperty("nativeParallelBundles").GetArrayLength() != 4 ||
            comparison.GetProperty("nativeParallelComparisons").GetInt32() != 512 ||
            comparison.GetProperty("stage0ApplicableObservations").GetInt32() != 63 ||
            comparison.GetProperty("stage0Comparisons").GetInt32() != 126 ||
            comparison.GetProperty("comparisonsPerConfiguration").GetInt32() != 1990);
        RequireArray(comparison.GetProperty("nativeMaterialFields"), "status", "schemaSetIdentity", "definitionSetIdentity", "descriptors", "workflowId", "sourceContentHash", "normalizedBase64", "normalizedHash", "diagnostics", "diagnosticCount");
        RequireArray(comparison.GetProperty("nativePairings"), "expected-native");
        RequireArray(comparison.GetProperty("nativeRepeatBundles"), "outcome-identities", "descriptors", "workflow-bytes-hashes", "diagnostics-count");
        RequireArray(comparison.GetProperty("nativeParallelCaseIds"), "route-workflow");
        RequireArray(comparison.GetProperty("nativeParallelBundles"), "outcome-identities", "descriptors", "workflow-bytes-hashes", "diagnostics-count");
        RequireArray(comparison.GetProperty("stage0MaterialFields"), "verdict", "orderedPhaseIds");
        RequireArray(comparison.GetProperty("stage0Pairings"), "expected-python");
        RequireArray(comparison.GetProperty("configurations"), "Debug", "Release");
        ValidateLimits(root.GetProperty("limits"));
    }

    static void ValidateExpected(JsonElement expected)
    {
        RequireMembers(expected, "status", "schemaSetIdentity", "definitionSetIdentity", "descriptors", "workflowId", "sourceContentHash", "contentHash", "normalizedBase64", "normalizedLength", "normalizedHash", "diagnostics", "diagnosticCount");
        _ = Status(expected.GetProperty("status").GetString()!);
        if (expected.GetProperty("diagnosticCount").GetInt32() != expected.GetProperty("diagnostics").GetArrayLength()) throw new InvalidDefinitionWorkflowCorpus();
        foreach (var descriptor in expected.GetProperty("descriptors").EnumerateArray())
        {
            RequireMembers(descriptor, "logicalId", "kind", "kindValue", "schemaId", "schemaClosureIdentity", "contentHash");
            if ((int)Kind(descriptor.GetProperty("kind").GetString()!) != descriptor.GetProperty("kindValue").GetInt32()) throw new InvalidDefinitionWorkflowCorpus();
        }
        foreach (var diagnostic in expected.GetProperty("diagnostics").EnumerateArray())
        {
            RequireMembers(diagnostic, "code", "codeValue", "severity", "status", "logicalId", "location", "relatedId", "canonicalCode", "schemaCode");
            RejectIf(diagnostic.GetProperty("severity").GetString() != "error" ||
                !Enum.TryParse<DefinitionDiagnosticCode>(diagnostic.GetProperty("code").GetString(), false, out var code) ||
                !Enum.IsDefined(code) || (int)code != diagnostic.GetProperty("codeValue").GetInt32() ||
                diagnostic.GetProperty("status").GetString() is not ("violation" or "rejected" or "limit-exceeded"));
            ValidateNullableEnum<CanonicalJsonFailureCode>(diagnostic.GetProperty("canonicalCode"));
            ValidateNullableEnum<SchemaDiagnosticCode>(diagnostic.GetProperty("schemaCode"));
        }
        var normalized = NullableString(expected.GetProperty("normalizedBase64"));
        if (normalized is not null)
        {
            var bytes = Convert.FromBase64String(normalized);
            var value = CanonicalJson.Parse(bytes);
            var selfHash = CanonicalJsonSelfHash.Verify(value, CanonicalJsonSelfHashField.ContentHash);
            RejectIf(bytes.Length != expected.GetProperty("normalizedLength").GetInt32() || Sha256Hash.Calculate(bytes).Value != expected.GetProperty("normalizedHash").GetString() ||
                selfHash.Status is not CanonicalJsonSelfHashVerificationStatus.Verified || selfHash.Actual?.Value != expected.GetProperty("contentHash").GetString() ||
                value.RootElement.GetProperty("contentHash").GetString() != expected.GetProperty("contentHash").GetString());
        }
        else
        {
            RejectIf(expected.GetProperty("normalizedLength").ValueKind is not JsonValueKind.Null || expected.GetProperty("normalizedHash").ValueKind is not JsonValueKind.Null);
        }
    }

    static void ValidateStage0(JsonElement value)
    {
        RequireMembers(value, "observable", "verdict", "orderedPhaseIds");
        if (value.GetProperty("observable").GetBoolean())
        {
            var verdict = value.GetProperty("verdict").GetString();
            RejectIf(verdict is not ("accepted" or "rejected"));
            RejectIf(verdict == "accepted" && value.GetProperty("orderedPhaseIds").ValueKind is not JsonValueKind.Array);
            RejectIf(verdict == "rejected" && value.GetProperty("orderedPhaseIds").ValueKind is not JsonValueKind.Null);
        }
        else
        {
            RejectIf(value.GetProperty("verdict").ValueKind is not JsonValueKind.Null || value.GetProperty("orderedPhaseIds").ValueKind is not JsonValueKind.Null);
        }
    }

    static void ValidateIdentifiersAndAssets(JsonElement root, IReadOnlyDictionary<string, byte[]> assets)
    {
        var identifiers = new HashSet<string>(StringComparer.Ordinal);
        var identified = root.GetProperty("acceptedSchemaSet").GetProperty("schemas").EnumerateArray()
            .Concat(root.GetProperty("definitionArtifacts").EnumerateArray())
            .Concat(root.GetProperty("stage0Mappings").EnumerateArray())
            .Concat(root.GetProperty("generators").EnumerateArray())
            .Concat(root.GetProperty("cases").EnumerateArray());
        foreach (var item in identified)
        {
            if (!identifiers.Add(item.GetProperty("id").GetString()!))
            {
                throw new InvalidDefinitionWorkflowCorpus();
            }
        }
        var paths = root.GetProperty("acceptedSchemaSet").GetProperty("schemas").EnumerateArray().Select(_ => _.GetProperty("path").GetString()!)
            .Concat(root.GetProperty("definitionArtifacts").EnumerateArray().Select(_ => _.GetProperty("path").GetString()!)).ToArray();
        RejectIf(paths.Distinct(StringComparer.Ordinal).Count() != paths.Length ||
            !paths.Order(StringComparer.Ordinal).SequenceEqual(assets.Keys.Order(StringComparer.Ordinal), StringComparer.Ordinal) ||
            paths.Any(_ => _.StartsWith('/') || _.Contains("..", StringComparison.Ordinal) || _.Contains('\\')));
    }

    static void ValidateSchemaInput(JsonElement input)
    {
        var mode = input.GetProperty("mode").GetString();
        if (mode is not ("accepted" or "null" or "accepted-plus-inline")) throw new InvalidDefinitionWorkflowCorpus();
        if (string.Equals(mode, "accepted-plus-inline", StringComparison.Ordinal))
        {
            VerifyInline(input, Convert.FromBase64String(input.GetProperty("inlineBase64").GetString()!));
            return;
        }
        RejectIf(input.GetProperty("schemaId").ValueKind is not JsonValueKind.Null || input.GetProperty("inlineBase64").ValueKind is not JsonValueKind.Null ||
            input.GetProperty("rawSha256").ValueKind is not JsonValueKind.Null || input.GetProperty("canonicalHash").ValueKind is not JsonValueKind.Null);
        RejectIf(string.Equals(mode, "null", StringComparison.Ordinal) && input.GetProperty("expectedIdentity").ValueKind is not JsonValueKind.Null);
    }

    static void ValidateLimits(JsonElement limits)
    {
        var expected = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["definitions"] = 256, ["aggregateDefinitionBytes"] = 8_000_000, ["definitionBytes"] = 2_000_000,
            ["retainedDefinitionBytes"] = 2_000_001, ["logicalIdScalars"] = 256, ["capabilities"] = 16,
            ["workflowInputs"] = 16, ["phases"] = 16, ["phaseInputs"] = 64, ["gates"] = 32,
            ["dependencyEdges"] = 64, ["semanticWorkUnits"] = 256, ["diagnostics"] = 256, ["normalizedBytes"] = 2_000_000
        };
        foreach (var pair in expected)
        {
            if (limits.GetProperty(pair.Key).GetInt32() != pair.Value) throw new InvalidDefinitionWorkflowCorpus();
        }
    }

    static void RequireArray(JsonElement value, params string[] expected)
    {
        if (!value.EnumerateArray().Select(_ => _.GetString()).SequenceEqual(expected, StringComparer.Ordinal)) throw new InvalidDefinitionWorkflowCorpus();
    }

    static void ValidateNullableEnum<T>(JsonElement value)
        where T : struct, Enum
    {
        if (value.ValueKind is JsonValueKind.Null) return;
        if (!Enum.TryParse<T>(value.GetString(), false, out var parsed) || !Enum.IsDefined(parsed)) throw new InvalidDefinitionWorkflowCorpus();
    }

    static void RequireMembers(JsonElement value, params string[] names)
    {
        var actual = value.EnumerateObject().Select(_ => _.Name).Order(StringComparer.Ordinal).ToArray();
        var expected = names.Order(StringComparer.Ordinal).ToArray();
        if (!actual.SequenceEqual(expected, StringComparer.Ordinal)) throw new InvalidDefinitionWorkflowCorpus();
    }

    static void RejectIf(bool condition)
    {
        if (condition)
        {
            throw new InvalidDefinitionWorkflowCorpus();
        }
    }

    static void RequireString(JsonElement value, string name, string expected)
    {
        if (value.GetProperty(name).GetString() != expected) throw new InvalidDefinitionWorkflowCorpus();
    }

    static int GeneratorBoundary(JsonElement root, JsonElement generated)
    {
        var generator = root.GetProperty("generators").EnumerateArray().Single(_ => _.GetProperty("id").GetString() == generated.GetProperty("generator").GetString());
        return generator.GetProperty(generated.GetProperty("boundary").GetString() == "maximum" ? "maximum" : "maximumPlusOne").GetInt32();
    }

    static string GeneratorWorkflowId(string id) => id switch
    {
        "definition-count" or "aggregate-definition-bytes" or "logical-id-scalars" => "missing-workflow",
        "capability-count" => "capability-limit-workflow",
        "workflow-input-count" => "workflow-input-limit-workflow",
        "phase-count" => "phase-limit-workflow",
        "phase-input-count" => "phase-input-limit-workflow",
        "gate-count" => "gate-limit-workflow",
        "dependency-edge-count" => "dependency-edge-limit-workflow",
        "semantic-work" => "semantic-work-limit-workflow",
        _ => throw new InvalidDefinitionWorkflowCorpus()
    };

    static DefinitionKind Kind(string value) => value switch
    {
        "capability-catalog" => DefinitionKind.CapabilityCatalog,
        "evaluation-catalog" => DefinitionKind.EvaluationCatalog,
        "policy" => DefinitionKind.Policy,
        "profile" => DefinitionKind.Profile,
        "project-manifest" => DefinitionKind.ProjectManifest,
        "workflow" => DefinitionKind.Workflow,
        "agent-context" => DefinitionKind.AgentContext,
        "artifact-descriptor" => DefinitionKind.ArtifactDescriptor,
        "artifact-provenance" => DefinitionKind.ArtifactProvenance,
        "artifact-receipt" => DefinitionKind.ArtifactReceipt,
        "phase-envelope" => DefinitionKind.PhaseEnvelope,
        "run-input-set" => DefinitionKind.RunInputSet,
        "sanitization-attestation" => DefinitionKind.SanitizationAttestation,
        "unknown" => DefinitionKind.Unknown,
        _ => throw new InvalidDefinitionWorkflowCorpus()
    };

    static string Token(DefinitionCompilationStatus status) => status switch
    {
        DefinitionCompilationStatus.Compiled => "compiled",
        DefinitionCompilationStatus.Rejected => "rejected",
        DefinitionCompilationStatus.DiagnosticLimitExceeded => "diagnostic-limit-exceeded",
        DefinitionCompilationStatus.EvaluationLimitExceeded => "evaluation-limit-exceeded",
        _ => throw new InvalidDefinitionWorkflowCorpus()
    };

    static DefinitionCompilationStatus Status(string value) => value switch
    {
        "compiled" => DefinitionCompilationStatus.Compiled,
        "rejected" => DefinitionCompilationStatus.Rejected,
        "diagnostic-limit-exceeded" => DefinitionCompilationStatus.DiagnosticLimitExceeded,
        "evaluation-limit-exceeded" => DefinitionCompilationStatus.EvaluationLimitExceeded,
        _ => throw new InvalidDefinitionWorkflowCorpus()
    };

    static string DiagnosticStatus(string value) => value switch
    {
        "violation" => "Violation",
        "rejected" => "Rejected",
        "limit-exceeded" => "LimitExceeded",
        _ => throw new InvalidDefinitionWorkflowCorpus()
    };

    static string? NullableString(JsonElement value) => value.ValueKind is JsonValueKind.Null ? null : value.GetString();
    static int? NullableInt(JsonElement value) => value.ValueKind is JsonValueKind.Null ? null : value.GetInt32();

    sealed class LoadedCorpus(JsonElement root, List<DefinitionWorkflowCorpusObservation> observations, int nativeComparisons)
    {
        public JsonElement Root { get; } = root;
        public List<DefinitionWorkflowCorpusObservation> Observations { get; } = observations;
        public int NativeComparisons { get; set; } = nativeComparisons;
    }

    sealed record DefinitionAsset(string LogicalId, DefinitionKind Kind, byte[] Bytes);

    sealed class ThrowingDefinitions(IEnumerable<DefinitionDocument> definitions, int failureAfter) : IEnumerable<DefinitionDocument>
    {
        public IEnumerator<DefinitionDocument> GetEnumerator() => new ThrowingEnumerator(definitions.GetEnumerator(), failureAfter);
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        sealed class ThrowingEnumerator(IEnumerator<DefinitionDocument> inner, int failureAfter) : IEnumerator<DefinitionDocument>
        {
            int _count;
            public DefinitionDocument Current => inner.Current;
            object IEnumerator.Current => Current;
            public bool MoveNext()
            {
                if (_count++ == failureAfter) throw new CorpusEnumerationFailure();
                return inner.MoveNext();
            }
            public void Reset() => throw new CorpusEnumerationFailure();
            public void Dispose() => inner.Dispose();
        }
    }
}

public sealed record DefinitionWorkflowCorpusRun(
    int NativeComparisons,
    IReadOnlyList<string> Failures,
    IReadOnlyList<DefinitionWorkflowCorpusObservation> Observations);

public sealed record DefinitionWorkflowCorpusPreparation(
    IReadOnlyList<DefinitionWorkflowCorpusObservation> Observations,
    IReadOnlyList<string> Failures);

public sealed record DefinitionWorkflowCorpusObservation(
    string Id,
    string? WorkflowId,
    SchemaResourceSet? Schemas,
    IReadOnlyList<DefinitionDocument> Definitions,
    int? EnumerationFailureAfter,
    JsonElement Expected,
    JsonElement Stage0Expected,
    bool IsCase);

sealed class InvalidDefinitionWorkflowCorpus : Exception
{
    public InvalidDefinitionWorkflowCorpus()
        : base("The definition workflow corpus is invalid.")
    {
    }
}

sealed class CorpusEnumerationFailure : Exception
{
    public CorpusEnumerationFailure()
        : base("The corpus enumeration failed.")
    {
    }
}
