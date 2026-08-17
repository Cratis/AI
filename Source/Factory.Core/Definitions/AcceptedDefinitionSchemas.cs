// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.Definitions;

static class AcceptedDefinitionSchemas
{
    public const string Identity = "sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99";
    public const int DocumentCount = 29;
    public const int ResourceCount = 29;
    public const int ReferenceCount = 369;
    public const int AnchorCount = 0;

    static readonly AcceptedSchema[] _schemas =
    [
        new("https://schemas.cratis.io/factory/v1/approval-decision.schema.json", "sha256:329f0f015b23c25a4f22d7b26609249f3fc8acd75c6bfb3da25566afa3fe7155", 0),
        new("https://schemas.cratis.io/factory/v1/capability-catalog.schema.json", "sha256:f2e413963a8b7b2b7ed86ede9c9482fcbccae2afa655fb7e8e16dd2b1caebdb7", 0),
        new("https://schemas.cratis.io/factory/v1/chronicle-read-grant.schema.json", "sha256:299fb60767d5693dc50b02d2719570a11ceb1320484dea32f3160bc4b333932c", 0),
        new("https://schemas.cratis.io/factory/v1/compiled-workflow.schema.json", "sha256:6b459b743c241ab60607dbd3949cf2c9a1b2f7404140cca6dee1bb660e303405", 45),
        new("https://schemas.cratis.io/factory/v1/definition-validation-result.schema.json", "sha256:5dcdf8af3d8fa279ca18da04405bf94c75c5c67c88259e1d51f1aa0bf14564c2", 1),
        new("https://schemas.cratis.io/factory/v1/diagnostic.schema.json", "sha256:b00b0f9039804b8af6ff86e525db096d3862a15a2ca3aa721b17a42cb7276101", 9),
        new("https://schemas.cratis.io/factory/v1/evaluation-catalog.schema.json", "sha256:5ea379ccd57ff8126ca8f5fd9de0cbd2bf83b1001741ca2d21c58942fbd23b4b", 18),
        new("https://schemas.cratis.io/factory/v1/evaluation-result.schema.json", "sha256:b513f3451ca5d26381972a60a9108b630496a82a72f77ef01525b482e07c6064", 19),
        new("https://schemas.cratis.io/factory/v1/factory-objective.schema.json", "sha256:7bf518128eeb57113cd194a21697d645ad164a6f98a48ef90fde37b2d50b9423", 0),
        new("https://schemas.cratis.io/factory/v1/gate-report.schema.json", "sha256:5f742b153ea9535f5e30d71a585a68236cbb6ae70b05173e1064d0caa4a1f7f2", 0),
        new("https://schemas.cratis.io/factory/v1/harness-event.schema.json", "sha256:204d228becfa8c2f881ea150408427a8226f7c65150345855ecbacff897a3f14", 29),
        new("https://schemas.cratis.io/factory/v1/harness-request.schema.json", "sha256:3dd1747ea9a53f53142f9fd5853945f344c2562e171c32bf301a64acc9b40d20", 53),
        new("https://schemas.cratis.io/factory/v1/investigation-result.schema.json", "sha256:055c90ee2300f41b6643708c3152cc3336e8b7b7492f588902e03e66e771e231", 3),
        new("https://schemas.cratis.io/factory/v1/next-action.schema.json", "sha256:e0987753181bd5ff04ddc57679339d6c488a6e745e933755796f0487d50acb12", 31),
        new("https://schemas.cratis.io/factory/v1/operation-result.schema.json", "sha256:7ef2adc7da5c78173f720e85bd665caa91a4393bb542b0afa975d2542ffdd1a6", 7),
        new("https://schemas.cratis.io/factory/v1/phase-envelope.schema.json", "sha256:8cfb8ca8a6686212d9242c63cf06cbe4999aa6e7ee3316db6390d286d45dd8ff", 5),
        new("https://schemas.cratis.io/factory/v1/policy.schema.json", "sha256:f1dbf19c03a0cd890180866665eaaa79f0ea095b1fff5af637d2a2081de0b0c9", 0),
        new("https://schemas.cratis.io/factory/v1/profile.schema.json", "sha256:814cfe729973adfd3fc4d82f11fa5225ee32b5b57ac6d0e95e5a4cc8ca5feaed", 19),
        new("https://schemas.cratis.io/factory/v1/project-manifest.schema.json", "sha256:d50da8ccc85b50b835e99e28fd3992df6485f30ae796fab8d5911de9295b1ba5", 0),
        new("https://schemas.cratis.io/factory/v1/repository-snapshot.schema.json", "sha256:f26d7a1161d0c7fa2b2aa548d1446c3d67c0a1282ada09eb50f4bab170c5280c", 0),
        new("https://schemas.cratis.io/factory/v1/resolved-profile.schema.json", "sha256:aee213448c94a99fbf981392207edebe12e4a6f3bbb9893f11235ad26a5168f0", 17),
        new("https://schemas.cratis.io/factory/v1/workflow.schema.json", "sha256:377c68ed4c8c3a71746bd38aba0d7c8e527208f32fc17760a289ba3583b01d83", 24),
        new("https://schemas.cratis.io/factory/v2/agent-context.schema.json", "sha256:5a9b529c3004c79df046f378aa196a2c69ef99ae5b138c37cc56d0c8bb3cb519", 16),
        new("https://schemas.cratis.io/factory/v2/artifact-descriptor.schema.json", "sha256:783a1db2e2250fa27137c266ab83002761b12d2f5d5db9f02b0a376bedcbe0bd", 6),
        new("https://schemas.cratis.io/factory/v2/artifact-provenance.schema.json", "sha256:2585718635d975b54999e86346ab2a6571250fb6147e32bd0d34bdd4fd68de12", 19),
        new("https://schemas.cratis.io/factory/v2/artifact-receipt.schema.json", "sha256:ca17accfb6215c9e3c21aff0fbdc219a8f587f8eb002c91a535ac8438682329d", 7),
        new("https://schemas.cratis.io/factory/v2/phase-envelope.schema.json", "sha256:828b6caed0ca93a199e7145df1df088dbf600f9e55fb4e4d05435c542940ec69", 17),
        new("https://schemas.cratis.io/factory/v2/run-input-set.schema.json", "sha256:eeb0d354a7c39fe429c3da79908116b498ef657625197aaa9611f2e96cdd98a4", 9),
        new("https://schemas.cratis.io/factory/v2/sanitization-attestation.schema.json", "sha256:b07ce257803c83cc7aa5f24b440e46c185725490793febc5bae0b486789554f0", 15)
    ];

    public static bool IsEquivalent(SchemaResourceSet schemas)
    {
        if (schemas.Identity.Value != Identity ||
            schemas.Documents.Count != DocumentCount ||
            schemas.Resources.Count != ResourceCount ||
            schemas.ReferenceCount != ReferenceCount ||
            schemas.AnchorCount != AnchorCount)
        {
            return false;
        }

        for (var index = 0; index < _schemas.Length; index++)
        {
            var expected = _schemas[index];
            var document = schemas.Documents[index];
            var resource = schemas.Resources[index];
            if (document.SchemaId != expected.SchemaId ||
                document.ContentHash.Value != expected.ContentHash ||
                document.ReferenceCount != expected.ReferenceCount ||
                resource.SchemaId != expected.SchemaId ||
                resource.DocumentId != expected.SchemaId ||
                resource.ContentHash.Value != expected.ContentHash ||
                resource.ReferenceCount != expected.ReferenceCount)
            {
                return false;
            }
        }

        foreach (var route in DefinitionSchemaRoutes.All)
        {
            var closure = schemas.GetClosure(route.Value.SchemaId);
            if (closure.Status is not SchemaClosureStatus.Resolved || closure.Closure!.Identity.Value != route.Value.ClosureIdentity)
            {
                return false;
            }
        }

        return true;
    }

    sealed record AcceptedSchema(string SchemaId, string ContentHash, int ReferenceCount);
}

static class DefinitionSchemaRoutes
{
    public static IReadOnlyDictionary<DefinitionKind, DefinitionSchemaRoute> All { get; } =
        new Dictionary<DefinitionKind, DefinitionSchemaRoute>
        {
            [DefinitionKind.CapabilityCatalog] = new("https://schemas.cratis.io/factory/v1/capability-catalog.schema.json", "sha256:a6ac73a61c0a52ba5e5f713ba453c434da3378eb16bd1e562686f71b31156e9b"),
            [DefinitionKind.EvaluationCatalog] = new("https://schemas.cratis.io/factory/v1/evaluation-catalog.schema.json", "sha256:95d551d66e08f788d98c4ca726be90a685030687edd6fc480a2ca720a7ecab4a"),
            [DefinitionKind.Policy] = new("https://schemas.cratis.io/factory/v1/policy.schema.json", "sha256:1be4ce2c08c5da4d2e61a3649084c1733fe0326cc9a769eec50d8a906df726ec"),
            [DefinitionKind.Profile] = new("https://schemas.cratis.io/factory/v1/profile.schema.json", "sha256:c7f060bfab62a5bc970c2a07f8b4977c3157373cfc17e2371fc737ffd40c04bb"),
            [DefinitionKind.ProjectManifest] = new("https://schemas.cratis.io/factory/v1/project-manifest.schema.json", "sha256:2b6676562bddf06156fea373b79ee59a8f85250f042b06db846cfc2efa4f4dcf"),
            [DefinitionKind.Workflow] = new("https://schemas.cratis.io/factory/v1/workflow.schema.json", "sha256:b537ae47b4a67ca3c1afdc89266aab4edaff9ca0d023fb7fd611920bb0c444b0"),
            [DefinitionKind.AgentContext] = new("https://schemas.cratis.io/factory/v2/agent-context.schema.json", "sha256:3edc78d5ac982f8cfa1e5999f88c3734699e245e39a3a228c5b73150db1a886f"),
            [DefinitionKind.ArtifactDescriptor] = new("https://schemas.cratis.io/factory/v2/artifact-descriptor.schema.json", "sha256:f4a96d0cb3eaf32ee68a33cdd561007c69c182b4c9bb18f0608165c9af7603fa"),
            [DefinitionKind.ArtifactProvenance] = new("https://schemas.cratis.io/factory/v2/artifact-provenance.schema.json", "sha256:db018569f3bd6b068211f6f933d4aacc734df6d8a2813c9cce16257a692a22e6"),
            [DefinitionKind.ArtifactReceipt] = new("https://schemas.cratis.io/factory/v2/artifact-receipt.schema.json", "sha256:139e46da52dbd6248b6c1b0c803bf2e9742ce5ee4c616bc3cbe31774776f2f36"),
            [DefinitionKind.PhaseEnvelope] = new("https://schemas.cratis.io/factory/v2/phase-envelope.schema.json", "sha256:4e93645a4dc31f526ab4b0b978ad240aabbe171609d897c6f0d1860c8e606c4a"),
            [DefinitionKind.RunInputSet] = new("https://schemas.cratis.io/factory/v2/run-input-set.schema.json", "sha256:8e21f9d30ff3d80d8b99e96b16baa477dd2aee5a1798d3cd5a61183a5f2e337d"),
            [DefinitionKind.SanitizationAttestation] = new("https://schemas.cratis.io/factory/v2/sanitization-attestation.schema.json", "sha256:db8f2f785b90e9f0f88d08240b42b644b716e1c043aef7d4a26ea4a5b4e6b6b3")
        };
}

sealed record DefinitionSchemaRoute(string SchemaId, string ClosureIdentity);
