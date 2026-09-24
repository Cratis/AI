// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.Copilot;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for GitHub Copilot.
/// <para>
/// Copilot's model catalog lives behind its own API at <c>api.githubcopilot.com/models</c>, in the
/// same <c>{ "data": [ { "id": ... } ] }</c> shape <see cref="IModelCatalogReader"/> already reads,
/// and it is the right catalog to ask: those ids are what <c>--model</c> on the Copilot CLI accepts,
/// so what this lists is what a tier can actually be mapped to. Reaching it takes two calls - a
/// GitHub credential is exchanged for a short-lived Copilot token first, the same exchange the CLI
/// performs at startup.
/// </para>
/// <para>
/// That exchange endpoint is not part of GitHub's published REST API. So this does not treat a
/// refusal as a defect: when either call fails, the catalog is reported unavailable with the reason,
/// which <see cref="ModelCatalogUnavailable"/> already defines as "ask again later, and let somebody
/// name the tier models by hand in the meantime". What it must never do is invent a list - a tier
/// mapped to a model nobody verified dispatches work to a model that may not exist (#1187).
/// </para>
/// </summary>
/// <param name="reader">The <see cref="IModelCatalogReader"/> the catalog is read through.</param>
/// <param name="tokens">Exchanges the GitHub credential for a Copilot API token.</param>
[Singleton]
public class CopilotModelListing(IModelCatalogReader reader, ICopilotApiTokens tokens) : ICanListAvailableModels
{
    /// <summary>
    /// Copilot's own model catalog - the same endpoint the CLI reads its <c>/model</c> list from.
    /// </summary>
    public const string CatalogUrl = "https://api.githubcopilot.com/models";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.Copilot;

    /// <inheritdoc/>
    public async Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider)
    {
        if (!CopilotCredential.IsUsable(provider.ApiKey))
        {
            throw new ModelCatalogUnavailable("GitHub Copilot", "the provider is not connected to a GitHub account yet - connect it, or name the models for each tier by hand");
        }

        var token = await tokens.Exchange(provider.ApiKey)
            ?? throw new ModelCatalogUnavailable("GitHub Copilot", "GitHub would not issue a Copilot token for this credential - check that the account holds a Copilot seat, or name the models for each tier by hand");

        return await reader.Read(
            CatalogUrl,
            [
                new("Authorization", $"Bearer {token}"),

                // Copilot's API rejects a request that does not identify the client it is coming
                // from. The values are an identity, not a version check - stated plainly so nobody
                // later mistakes them for something that has to track a real editor's releases.
                new("Editor-Version", "Cratis-Direct/1.0"),
                new("Copilot-Integration-Id", "vscode-chat")
            ]);
    }
}
