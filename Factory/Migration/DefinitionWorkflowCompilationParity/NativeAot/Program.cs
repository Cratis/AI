// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using Cratis.Factory.Definitions;
using Cratis.Factory.Hashing;
using Cratis.Factory.SchemaValidation;
using Json.Schema;

namespace Cratis.Factory.DefinitionWorkflowNativeAot;

static class Program
{
    const string ExpectedSchemaIdentity = "sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99";
    const string ExpectedDefinitionIdentity = "sha256:9b18cca64b9ed72c68b679d848404ae2fe14b82fe20aeb95aae7538bc7c97ef0";
    const string ExpectedSourceHash = "sha256:984ec3c0a69821fa9d3d5a2ab129d22d4ea0a2168e916e47df48d938388fcb89";
    const string ExpectedContentHash = "sha256:936225aa0bea273c1f193f540fe5fe081b982dc4e12e9e169fbd4011fc208bd0";
    const string ExpectedWholeHash = "sha256:3741b6b542f1f9bd4fd0d008f4f067994f38be585c23cf3c18ced210997e9675";

    static readonly string[] _schemaPaths =
    [
        "Contracts/v1/approval-decision.schema.json", "Contracts/v1/capability-catalog.schema.json",
        "Contracts/v1/chronicle-read-grant.schema.json", "Contracts/v1/compiled-workflow.schema.json",
        "Contracts/v1/definition-validation-result.schema.json", "Contracts/v1/diagnostic.schema.json",
        "Contracts/v1/evaluation-catalog.schema.json", "Contracts/v1/evaluation-result.schema.json",
        "Contracts/v1/factory-objective.schema.json", "Contracts/v1/gate-report.schema.json",
        "Contracts/v1/harness-event.schema.json", "Contracts/v1/harness-request.schema.json",
        "Contracts/v1/investigation-result.schema.json", "Contracts/v1/next-action.schema.json",
        "Contracts/v1/operation-result.schema.json", "Contracts/v1/phase-envelope.schema.json",
        "Contracts/v1/policy.schema.json", "Contracts/v1/profile.schema.json",
        "Contracts/v1/project-manifest.schema.json", "Contracts/v1/repository-snapshot.schema.json",
        "Contracts/v1/resolved-profile.schema.json", "Contracts/v1/workflow.schema.json",
        "Contracts/v2/agent-context.schema.json", "Contracts/v2/artifact-descriptor.schema.json",
        "Contracts/v2/artifact-provenance.schema.json", "Contracts/v2/artifact-receipt.schema.json",
        "Contracts/v2/phase-envelope.schema.json", "Contracts/v2/run-input-set.schema.json",
        "Contracts/v2/sanitization-attestation.schema.json"
    ];

    static readonly DefinitionResource[] _definitions =
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
        if (arguments.Length != 1) return 1;
        Environment.SetEnvironmentVariable("CRATIS_FACTORY_ROOT", "/poisoned/repository/root");
        Environment.SetEnvironmentVariable("FACTORY_REPOSITORY_ROOT", "/poisoned/snapshot/root");
        Environment.SetEnvironmentVariable("GIT_DIR", "/poisoned/git/directory");
        Environment.CurrentDirectory = arguments[0];

        var fetchCount = 0;
        var global = SchemaRegistry.Global;
        global.Register(new Uri("https://schemas.cratis.io/factory/v1/workflow.schema.json"), JsonSchema.False);
        global.Fetch = (_, _) =>
        {
            Interlocked.Increment(ref fetchCount);
            return JsonSchema.False;
        };

        var schemaLoad = SchemaResourceSet.Load(_schemaPaths.Select(_ => new SchemaDocument(SchemaId(_), Read(_))));
        if (schemaLoad.Status is not SchemaLoadStatus.Loaded || schemaLoad.ResourceSet?.Identity.Value != ExpectedSchemaIdentity)
        {
            Console.WriteLine($"BLOCKED schemaStatus={schemaLoad.Status} schemaIdentity={schemaLoad.ResourceSet?.Identity.Value}");
            return 1;
        }
        var documents = _definitions.Select(_ => new DefinitionDocument(_.LogicalId, _.Kind, Read(_.Path))).ToArray();
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        var before = GC.GetAllocatedBytesForCurrentThread();
        var timer = Stopwatch.StartNew();
        var result = DefinitionCompiler.Compile(schemaLoad.ResourceSet, documents, "investigate-cratis-issue");
        timer.Stop();
        var allocation = GC.GetAllocatedBytesForCurrentThread() - before;

        var passed = result.Status is DefinitionCompilationStatus.Compiled &&
                     result.SchemaSetIdentity?.Value == ExpectedSchemaIdentity &&
                     result.DefinitionSetIdentity?.Value == ExpectedDefinitionIdentity &&
                     result.Workflow?.SourceContentHash.Value == ExpectedSourceHash &&
                     result.Workflow?.ContentHash.Value == ExpectedContentHash &&
                     result.Workflow?.Utf8.Length == 7227 &&
                     result.Workflow is not null && Sha256Hash.Calculate(result.Workflow.Utf8).Value == ExpectedWholeHash &&
                     result.Diagnostics.Count == 0 && fetchCount == 0 &&
                     timer.Elapsed <= TimeSpan.FromSeconds(1) && allocation <= 256L * 1024 * 1024;
        Console.WriteLine(string.Create(CultureInfo.InvariantCulture, $"{(passed ? "PASSED" : "BLOCKED")} coldCommittedDefinitions=26 coldElapsedMs={timer.Elapsed.TotalMilliseconds:F3} coldElapsedCeilingMs=1000 coldAllocation={allocation} coldAllocationCeiling=268435456 repositoryReads=0 snapshotReads=0 fetches={fetchCount}"));
        return passed ? 0 : 1;
    }

    static byte[] Read(string path)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"snapshot/{path}") ?? throw new InvalidOperationException();
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return memory.ToArray();
    }

    static string SchemaId(string path) => $"https://schemas.cratis.io/factory/{path["Contracts/".Length..]}";

    sealed record DefinitionResource(string LogicalId, DefinitionKind Kind, string Path);
}
