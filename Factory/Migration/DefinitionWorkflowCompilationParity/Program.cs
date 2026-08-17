// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.Factory.Definitions;
using Cratis.Factory.DefinitionWorkflowCompilation;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.DefinitionWorkflowCompilationParity;

static class Program
{
    static readonly string[] _assetPaths =
    [
        "Contracts/v1/approval-decision.schema.json",
        "Contracts/v1/capability-catalog.schema.json",
        "Contracts/v1/chronicle-read-grant.schema.json",
        "Contracts/v1/compiled-workflow.schema.json",
        "Contracts/v1/definition-validation-result.schema.json",
        "Contracts/v1/diagnostic.schema.json",
        "Contracts/v1/evaluation-catalog.schema.json",
        "Contracts/v1/evaluation-result.schema.json",
        "Contracts/v1/examples/project-manifest.json",
        "Contracts/v1/factory-objective.schema.json",
        "Contracts/v1/gate-report.schema.json",
        "Contracts/v1/harness-event.schema.json",
        "Contracts/v1/harness-request.schema.json",
        "Contracts/v1/investigation-result.schema.json",
        "Contracts/v1/next-action.schema.json",
        "Contracts/v1/operation-result.schema.json",
        "Contracts/v1/phase-envelope.schema.json",
        "Contracts/v1/policy.schema.json",
        "Contracts/v1/profile.schema.json",
        "Contracts/v1/project-manifest.schema.json",
        "Contracts/v1/repository-snapshot.schema.json",
        "Contracts/v1/resolved-profile.schema.json",
        "Contracts/v1/workflow.schema.json",
        "Contracts/v2/agent-context.schema.json",
        "Contracts/v2/artifact-descriptor.schema.json",
        "Contracts/v2/artifact-provenance.schema.json",
        "Contracts/v2/artifact-receipt.schema.json",
        "Contracts/v2/examples/agent-context.json",
        "Contracts/v2/examples/artifact-descriptor.json",
        "Contracts/v2/examples/artifact-provenance.json",
        "Contracts/v2/examples/artifact-receipt.json",
        "Contracts/v2/examples/phase-envelope.json",
        "Contracts/v2/examples/run-input-set.json",
        "Contracts/v2/examples/sanitization-attestation.json",
        "Contracts/v2/phase-envelope.schema.json",
        "Contracts/v2/run-input-set.schema.json",
        "Contracts/v2/sanitization-attestation.schema.json",
        "Evaluations/Factory/foundation.catalog.json",
        "Factory/Capabilities/foundation.capabilities.json",
        "Factory/Policies/local-development.policy.json",
        "Factory/Profiles/application-arc-dotnet.profile.json",
        "Factory/Profiles/application-arc-react.profile.json",
        "Factory/Profiles/application-chronicle-dotnet.profile.json",
        "Factory/Profiles/application-chronicle-elixir.profile.json",
        "Factory/Profiles/application-chronicle-jvm.profile.json",
        "Factory/Profiles/application-chronicle-typescript.profile.json",
        "Factory/Profiles/application-cratis-components.profile.json",
        "Factory/Profiles/cratis-dotnet-react.profile.json",
        "Factory/Profiles/framework-arc.profile.json",
        "Factory/Profiles/framework-chronicle-elixir.profile.json",
        "Factory/Profiles/framework-chronicle-jvm.profile.json",
        "Factory/Profiles/framework-chronicle-typescript.profile.json",
        "Factory/Profiles/framework-chronicle.profile.json",
        "Factory/Profiles/framework-components.profile.json",
        "Workflows/investigate-cratis-issue.factory.json"
    ];

    static readonly DefinitionResource[] _committedDefinitions =
    [
        new("project-manifest-example", DefinitionKind.ProjectManifest, "Contracts/v1/examples/project-manifest.json"),
        new("agent-context-example", DefinitionKind.AgentContext, "Contracts/v2/examples/agent-context.json"),
        new("artifact-descriptor-example", DefinitionKind.ArtifactDescriptor, "Contracts/v2/examples/artifact-descriptor.json"),
        new("artifact-provenance-example", DefinitionKind.ArtifactProvenance, "Contracts/v2/examples/artifact-provenance.json"),
        new("artifact-receipt-example", DefinitionKind.ArtifactReceipt, "Contracts/v2/examples/artifact-receipt.json"),
        new("phase-envelope-example", DefinitionKind.PhaseEnvelope, "Contracts/v2/examples/phase-envelope.json"),
        new("run-input-set-example", DefinitionKind.RunInputSet, "Contracts/v2/examples/run-input-set.json"),
        new("sanitization-attestation-example", DefinitionKind.SanitizationAttestation, "Contracts/v2/examples/sanitization-attestation.json"),
        new("foundation-evaluations", DefinitionKind.EvaluationCatalog, "Evaluations/Factory/foundation.catalog.json"),
        new("factory-foundation", DefinitionKind.CapabilityCatalog, "Factory/Capabilities/foundation.capabilities.json"),
        new("local-development", DefinitionKind.Policy, "Factory/Policies/local-development.policy.json"),
        new("application-arc-dotnet", DefinitionKind.Profile, "Factory/Profiles/application-arc-dotnet.profile.json"),
        new("application-arc-react", DefinitionKind.Profile, "Factory/Profiles/application-arc-react.profile.json"),
        new("application-chronicle-dotnet", DefinitionKind.Profile, "Factory/Profiles/application-chronicle-dotnet.profile.json"),
        new("application-chronicle-elixir", DefinitionKind.Profile, "Factory/Profiles/application-chronicle-elixir.profile.json"),
        new("application-chronicle-jvm", DefinitionKind.Profile, "Factory/Profiles/application-chronicle-jvm.profile.json"),
        new("application-chronicle-typescript", DefinitionKind.Profile, "Factory/Profiles/application-chronicle-typescript.profile.json"),
        new("application-cratis-components", DefinitionKind.Profile, "Factory/Profiles/application-cratis-components.profile.json"),
        new("cratis-dotnet-react", DefinitionKind.Profile, "Factory/Profiles/cratis-dotnet-react.profile.json"),
        new("framework-arc", DefinitionKind.Profile, "Factory/Profiles/framework-arc.profile.json"),
        new("framework-chronicle-elixir", DefinitionKind.Profile, "Factory/Profiles/framework-chronicle-elixir.profile.json"),
        new("framework-chronicle-jvm", DefinitionKind.Profile, "Factory/Profiles/framework-chronicle-jvm.profile.json"),
        new("framework-chronicle-typescript", DefinitionKind.Profile, "Factory/Profiles/framework-chronicle-typescript.profile.json"),
        new("framework-chronicle", DefinitionKind.Profile, "Factory/Profiles/framework-chronicle.profile.json"),
        new("framework-components", DefinitionKind.Profile, "Factory/Profiles/framework-components.profile.json"),
        new("investigate-cratis-issue", DefinitionKind.Workflow, "Workflows/investigate-cratis-issue.factory.json")
    ];

    static int Main(string[] arguments)
    {
        try
        {
            return arguments.Length == 1 && arguments[0] == "--performance"
                ? RunPerformance()
                : RunComparison();
        }
        catch (Exception error) when (error is not OutOfMemoryException and not StackOverflowException and not AccessViolationException)
        {
            Console.WriteLine("BLOCKED infrastructure failures=1");
            return 1;
        }
    }

    static int RunComparison()
    {
        var corpusBytes = ReadPhysicalSnapshot("Snapshot", "corpus.json");
        var assets = LoadAssets();
        var native = DefinitionWorkflowCorpusRunner.Run(corpusBytes, assets);
        if (native.NativeComparisons != 1864 || native.Observations.Count == 0)
        {
            Console.WriteLine($"BLOCKED historical-observer native={native.NativeComparisons}/1864 failures={native.Failures.Count}");
            return 1;
        }

        var stage0 = RunStage0(native.Observations, assets);
        if (stage0.Failures != 0 || stage0.Comparisons != 126)
        {
            Console.WriteLine($"BLOCKED historical-observer native=1864/1864 stage0={stage0.Comparisons}/126 failures={stage0.Failures}");
            return 1;
        }

        if (native.Failures.Count > 0)
        {
            Console.WriteLine($"HISTORICAL_DRIFT nativeComparisons=1864 semanticMismatches={native.Failures.Count} stage0=126/126 nonBlocking=true");
            foreach (var failure in native.Failures) Console.WriteLine($"historicalMismatch={failure}");
            return 0;
        }

        Console.WriteLine("HISTORICAL_MATCH nativeComparisons=1864 semanticMismatches=0 stage0=126/126 nonBlocking=true");
        return 0;
    }

    static int RunPerformance()
    {
        var inputs = LoadPerformanceInputs();
        var committed = inputs.Single(_ => _.Id == "compile-all-committed-definitions");
        var result = DefinitionCompiler.Compile(committed.Schemas, committed.Definitions, committed.WorkflowId);
        if (result.Status is not DefinitionCompilationStatus.Compiled) return 1;

        var warmElapsed = TimeSpan.Zero;
        long warmAllocation = 0;
        var warmResultsPassed = true;
        var timer = new Stopwatch();
        for (var iteration = 0; iteration < 20; iteration++)
        {
            var before = GC.GetAllocatedBytesForCurrentThread();
            timer.Restart();
            result = DefinitionCompiler.Compile(committed.Schemas, committed.Definitions, committed.WorkflowId);
            timer.Stop();
            warmElapsed += timer.Elapsed;
            warmAllocation += GC.GetAllocatedBytesForCurrentThread() - before;
            warmResultsPassed &= result.Status is DefinitionCompilationStatus.Compiled;
        }

        var structuralFailures = 0;
        var structuralResults = new List<string>();
        foreach (var observation in inputs.Where(_ => _.Id != "compile-all-committed-definitions"))
        {
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
            var before = GC.GetAllocatedBytesForCurrentThread();
            timer.Restart();
            result = DefinitionCompiler.Compile(observation.Schemas, observation.Definitions, observation.WorkflowId);
            timer.Stop();
            var allocation = GC.GetAllocatedBytesForCurrentThread() - before;
            var plusOne = observation.Id.EndsWith("/maximumPlusOne", StringComparison.Ordinal);
            var ceiling = plusOne ? TimeSpan.FromMilliseconds(250) : TimeSpan.FromSeconds(5);
            var allocationCeiling = plusOne ? 64L * 1024 * 1024 : 2L * 1024 * 1024 * 1024;
            if (timer.Elapsed > ceiling || allocation > allocationCeiling)
            {
                structuralFailures++;
            }
            structuralResults.Add(string.Create(CultureInfo.InvariantCulture, $"{observation.Id} elapsedMs={timer.Elapsed.TotalMilliseconds:F3} elapsedCeilingMs={ceiling.TotalMilliseconds:F0} allocation={allocation} allocationCeiling={allocationCeiling}"));
        }

        var warmMean = TimeSpan.FromTicks(warmElapsed.Ticks / 20);
        var warmAllocationMean = warmAllocation / 20;
        var warmPass = warmResultsPassed && warmMean <= TimeSpan.FromMilliseconds(250) && warmAllocationMean <= 128L * 1024 * 1024;
        var passed = warmPass && structuralFailures == 0;
        Console.WriteLine(string.Create(CultureInfo.InvariantCulture, $"{(passed ? "PASSED" : "BLOCKED")} warmCalls=20 warmMeanMs={warmMean.TotalMilliseconds:F3} warmMeanCeilingMs=250 warmAllocationMean={warmAllocationMean} warmAllocationCeiling=134217728 structuralFailures={structuralFailures}"));
        Console.WriteLine(string.Join(Environment.NewLine, structuralResults));
        return passed ? 0 : 1;
    }

    static Stage0Result RunStage0(
        IReadOnlyList<DefinitionWorkflowCorpusObservation> observations,
        IReadOnlyDictionary<string, byte[]> assets)
    {
        if (!VerifyOracle()) return new(0, 1);
        var schemaAssets = assets.Where(_ => _.Key.EndsWith(".schema.json", StringComparison.Ordinal)).ToDictionary(_ => _.Key, _ => Convert.ToBase64String(_.Value), StringComparer.Ordinal);
        var payloadObservations = new JsonArray();
        var expected = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var observation in observations)
        {
            IEnumerable<DefinitionDocument> definitions = observation.Definitions;
            if (observation.EnumerationFailureAfter is int failureAfter)
            {
                definitions = EnumerateWithFailure(observation.Definitions, failureAfter);
            }
            var fresh = DefinitionCompiler.Compile(observation.Schemas, definitions, observation.WorkflowId);
            var observable = fresh.DefinitionSetIdentity is not null;
            if (observable != observation.Stage0Expected.GetProperty("observable").GetBoolean()) return new(0, 1);
            if (!observable) continue;
            expected[observation.Id] = observation.Stage0Expected;
            payloadObservations.Add((JsonNode)new JsonObject
            {
                ["id"] = observation.Id,
                ["workflowId"] = observation.WorkflowId,
                ["definitions"] = new JsonArray(observation.Definitions.Select(_ => (JsonNode)new JsonObject
                {
                    ["logicalId"] = _.LogicalId,
                    ["kind"] = KindToken(_.Kind),
                    ["base64"] = Convert.ToBase64String(_.Utf8)
                }).ToArray())
            });
        }
        if (payloadObservations.Count != 63) return new(0, 1);
        var payload = new JsonObject
        {
            ["schemas"] = JsonSerializer.SerializeToNode(schemaAssets),
            ["observations"] = payloadObservations
        };

        var start = new ProcessStartInfo("python3")
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        start.ArgumentList.Add("-I");
        start.ArgumentList.Add("-B");
        start.ArgumentList.Add(System.IO.Path.Combine(AppContext.BaseDirectory, "stage0_adapter.py"));
        start.ArgumentList.Add(System.IO.Path.Combine(AppContext.BaseDirectory, "Oracle"));
        start.Environment["PYTHONDONTWRITEBYTECODE"] = "1";
        using var process = Process.Start(start)!;
        process.StandardInput.Write(payload.ToJsonString());
        process.StandardInput.Close();
        var output = process.StandardOutput.ReadToEnd();
        _ = process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0) return new(0, 1);

        using var response = JsonDocument.Parse(output);
        var comparisons = 0;
        var failures = 0;
        foreach (var item in response.RootElement.EnumerateArray())
        {
            var id = item.GetProperty("id").GetString()!;
            var expectedItem = expected[id];
            comparisons++;
            if (item.GetProperty("verdict").GetString() != expectedItem.GetProperty("verdict").GetString()) failures++;
            comparisons++;
            if (item.GetProperty("orderedPhaseIds").GetRawText() != expectedItem.GetProperty("orderedPhaseIds").GetRawText()) failures++;
        }
        return new(comparisons, failures);
    }

    static IEnumerable<DefinitionDocument> EnumerateWithFailure(
        IEnumerable<DefinitionDocument> definitions,
        int failureAfter)
    {
        var count = 0;
        foreach (var definition in definitions)
        {
            if (count++ == failureAfter) throw new Stage0EnumerationFailure();
            yield return definition;
        }
        if (count == failureAfter) throw new Stage0EnumerationFailure();
    }

    static Dictionary<string, byte[]> LoadAssets() => _assetPaths.ToDictionary(
        _ => _,
        _ => ReadPhysicalSnapshot("Snapshot", _),
        StringComparer.Ordinal);

    static List<PerformanceInput> LoadPerformanceInputs()
    {
        var schemaLoad = SchemaResourceSet.Load(_assetPaths
            .Where(_ => _.EndsWith(".schema.json", StringComparison.Ordinal))
            .Select(_ => new SchemaDocument(SchemaId(_), ReadPhysicalSnapshot("Snapshot", _))));
        if (schemaLoad.Status is not SchemaLoadStatus.Loaded || schemaLoad.ResourceSet?.Identity != DefinitionCompiler.AcceptedSchemaSetIdentity)
        {
            throw new InvalidPerformanceInput();
        }
        var schemas = schemaLoad.ResourceSet;
        var inputs = new List<PerformanceInput>
        {
            new(
                "compile-all-committed-definitions",
                schemas,
                [.. _committedDefinitions.Select(_ => new DefinitionDocument(_.LogicalId, _.Kind, ReadPhysicalSnapshot("Snapshot", _.Path)))],
                "investigate-cratis-issue")
        };
        var artifactDescriptor = ReadPhysicalSnapshot("Snapshot", "Contracts/v2/examples/artifact-descriptor.json");
        foreach (var boundary in PerformanceBoundaries())
        {
            inputs.Add(new(
                $"{boundary.Id}/maximum",
                schemas,
                DefinitionWorkflowCorpusGenerator.Generate(boundary.Id, boundary.Maximum, artifactDescriptor),
                GeneratorWorkflowId(boundary.Id)));
            inputs.Add(new(
                $"{boundary.Id}/maximumPlusOne",
                schemas,
                DefinitionWorkflowCorpusGenerator.Generate(boundary.Id, boundary.MaximumPlusOne, artifactDescriptor),
                GeneratorWorkflowId(boundary.Id)));
        }
        return inputs;
    }

    static IReadOnlyList<PerformanceBoundary> PerformanceBoundaries() =>
    [
        new("definition-count", 256, 257),
        new("aggregate-definition-bytes", 8_000_000, 8_000_001),
        new("logical-id-scalars", 256, 257),
        new("capability-count", 16, 17),
        new("workflow-input-count", 16, 17),
        new("phase-count", 16, 17),
        new("phase-input-count", 64, 65),
        new("gate-count", 32, 33),
        new("dependency-edge-count", 64, 65),
        new("semantic-work", 256, 257)
    ];

    static string? GeneratorWorkflowId(string generator) => generator switch
    {
        "definition-count" or "aggregate-definition-bytes" or "logical-id-scalars" => "missing-workflow",
        "capability-count" => "capability-limit-workflow",
        "workflow-input-count" => "workflow-input-limit-workflow",
        "phase-count" => "phase-limit-workflow",
        "phase-input-count" => "phase-input-limit-workflow",
        "gate-count" => "gate-limit-workflow",
        "dependency-edge-count" => "dependency-edge-limit-workflow",
        "semantic-work" => "semantic-work-limit-workflow",
        _ => throw new InvalidPerformanceInput()
    };

    static string SchemaId(string path) => $"https://schemas.cratis.io/factory/{path["Contracts/".Length..]}";

    static bool VerifyOracle()
    {
        var expected = new Dictionary<string, (string Hash, int Size)>(StringComparer.Ordinal)
        {
            ["canonical_json.py"] = ("7bcd362c2c30632096bd92a50a52b29611712986afee6e5de2d81d402d45a01c", 2535),
            ["validate_factory.py"] = ("6c81fc67e79cae875d0f872aa75d2c9d220fcb02bb018370ad1b65f1943a005e", 43658),
            ["compile_factory.py"] = ("024964637624d642f9cdc898ac4a6b5a46bd22b5650a2fb531221f84dc386998", 40266)
        };
        return expected.All(_ =>
        {
            var bytes = ReadPhysicalSnapshot("Oracle", _.Key);
            return bytes.Length == _.Value.Size && Convert.ToHexStringLower(SHA256.HashData(bytes)) == _.Value.Hash;
        });
    }

    static byte[] ReadPhysicalSnapshot(string directory, string relativePath)
    {
        if (relativePath.StartsWith('/') || relativePath.Contains("..", StringComparison.Ordinal) || relativePath.Contains('\\')) throw new UnsafePhysicalSnapshot();
        var root = new DirectoryInfo(System.IO.Path.Combine(AppContext.BaseDirectory, directory));
        RejectLink(root);
        var current = root;
        var parts = relativePath.Split('/');
        for (var index = 0; index < parts.Length - 1; index++)
        {
            current = new DirectoryInfo(System.IO.Path.Combine(current.FullName, parts[index]));
            RejectLink(current);
        }
        var file = new FileInfo(System.IO.Path.Combine(current.FullName, parts[^1]));
        RejectLink(file);
        return File.ReadAllBytes(file.FullName);
    }

    static void RejectLink(FileSystemInfo entry)
    {
        if (entry.Attributes.HasFlag(FileAttributes.ReparsePoint) || entry.ResolveLinkTarget(true) is not null) throw new UnsafePhysicalSnapshot();
    }

    static string KindToken(DefinitionKind kind) => kind switch
    {
        DefinitionKind.CapabilityCatalog => "capability-catalog",
        DefinitionKind.EvaluationCatalog => "evaluation-catalog",
        DefinitionKind.Policy => "policy",
        DefinitionKind.Profile => "profile",
        DefinitionKind.ProjectManifest => "project-manifest",
        DefinitionKind.Workflow => "workflow",
        DefinitionKind.AgentContext => "agent-context",
        DefinitionKind.ArtifactDescriptor => "artifact-descriptor",
        DefinitionKind.ArtifactProvenance => "artifact-provenance",
        DefinitionKind.ArtifactReceipt => "artifact-receipt",
        DefinitionKind.PhaseEnvelope => "phase-envelope",
        DefinitionKind.RunInputSet => "run-input-set",
        DefinitionKind.SanitizationAttestation => "sanitization-attestation",
        _ => "unknown"
    };

    sealed record Stage0Result(int Comparisons, int Failures);
    sealed record DefinitionResource(string LogicalId, DefinitionKind Kind, string Path);
    sealed record PerformanceBoundary(string Id, int Maximum, int MaximumPlusOne);
    sealed record PerformanceInput(string Id, SchemaResourceSet Schemas, IReadOnlyList<DefinitionDocument> Definitions, string? WorkflowId);

    sealed class Stage0EnumerationFailure : Exception;

    sealed class UnsafePhysicalSnapshot : Exception;
    sealed class InvalidPerformanceInput : Exception;
}
