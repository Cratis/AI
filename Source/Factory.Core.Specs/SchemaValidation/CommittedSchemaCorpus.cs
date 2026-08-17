// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation.Conformance;

static class CommittedSchemaCorpus
{
    const string V1 = "https://schemas.cratis.io/factory/v1/";
    const string V2 = "https://schemas.cratis.io/factory/v2/";

    public static IReadOnlyList<CommittedInstance> Instances { get; } =
    [
        new("Contracts/v1/examples/project-manifest.json", $"{V1}project-manifest.schema.json"),
        new("Contracts/v2/examples/agent-context.json", $"{V2}agent-context.schema.json"),
        new("Contracts/v2/examples/artifact-descriptor.json", $"{V2}artifact-descriptor.schema.json"),
        new("Contracts/v2/examples/artifact-provenance.json", $"{V2}artifact-provenance.schema.json"),
        new("Contracts/v2/examples/artifact-receipt.json", $"{V2}artifact-receipt.schema.json"),
        new("Contracts/v2/examples/phase-envelope.json", $"{V2}phase-envelope.schema.json"),
        new("Contracts/v2/examples/run-input-set.json", $"{V2}run-input-set.schema.json"),
        new("Contracts/v2/examples/sanitization-attestation.json", $"{V2}sanitization-attestation.schema.json"),
        new("Factory/Capabilities/foundation.capabilities.json", $"{V1}capability-catalog.schema.json"),
        new("Factory/Policies/local-development.policy.json", $"{V1}policy.schema.json"),
        new("Factory/Profiles/application-arc-dotnet.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/application-arc-react.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/application-chronicle-dotnet.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/application-chronicle-elixir.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/application-chronicle-jvm.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/application-chronicle-typescript.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/application-cratis-components.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/cratis-dotnet-react.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/framework-arc.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/framework-chronicle-elixir.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/framework-chronicle-jvm.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/framework-chronicle-typescript.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/framework-chronicle.profile.json", $"{V1}profile.schema.json"),
        new("Factory/Profiles/framework-components.profile.json", $"{V1}profile.schema.json"),
        new("Workflows/investigate-cratis-issue.factory.json", $"{V1}workflow.schema.json"),
        new("Evaluations/Factory/foundation.catalog.json", $"{V1}evaluation-catalog.schema.json")
    ];

    public static string RootPath { get; } = Path.Combine(AppContext.BaseDirectory, "RepositoryCorpus");

    public static IReadOnlyList<byte[]> LoadSchemaDocuments() =>
    [.. Directory.GetFiles(Path.Combine(RootPath, "Contracts"), "*.schema.json", SearchOption.AllDirectories)
            .Order(StringComparer.Ordinal)
            .Select(File.ReadAllBytes)];

    public static byte[] ReadInstance(CommittedInstance instance) => File.ReadAllBytes(Path.Combine(RootPath, instance.RelativePath));
}

sealed record CommittedInstance(string RelativePath, string SchemaId);
