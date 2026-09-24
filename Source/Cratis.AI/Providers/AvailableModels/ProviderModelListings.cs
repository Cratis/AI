// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.Anthropic;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for Anthropic - the Messages API publishes its model
/// catalog at <c>/v1/models</c> in the OpenAI-established shape.
/// </summary>
/// <param name="reader">The <see cref="IModelCatalogReader"/> the catalog is read through.</param>
[Singleton]
public class AnthropicModelListing(IModelCatalogReader reader) : ICanListAvailableModels
{
    const string ApiVersion = "2023-06-01";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.Anthropic;

    /// <inheritdoc/>
    public async Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider)
    {
        // Claude setup tokens authenticate Claude Code but do not authorize Anthropic's model-list
        // endpoint - asking always returns 401 even though completions work. This used to answer
        // with Direct's own hardcoded Anthropic catalog, which is exactly the assumption #1187 is
        // about: it presented four model names nobody had verified as the vendor's own answer, and a
        // tier mapped to one of them dispatched to a model that might not exist.
        var subscriptionToken = ProviderCatalogs.HasValue(provider.ApiKey) && AnthropicCredential.IsOAuthToken(provider.ApiKey);

        // A second key is often already configured for the usage and cost reports, and it is an
        // ordinary organization key as far as the Messages API is concerned. Asking with it is worth
        // a try before telling somebody to type four model names by hand - and when Anthropic
        // refuses it too, the failure says exactly that rather than blaming the subscription token
        // for a refusal that came from the other key.
        var credential = subscriptionToken || !ProviderCatalogs.HasValue(provider.ApiKey)
            ? provider.UsageApiKey
            : provider.ApiKey;

        if (!ProviderCatalogs.HasValue(credential))
        {
            var reason = subscriptionToken
                ? "a Claude subscription token cannot read Anthropic's model list, and no usage reporting key is configured to ask with instead - name the models for each tier by hand"
                : "the provider has no credential to ask with";
            throw new ModelCatalogUnavailable("Anthropic", reason);
        }

        try
        {
            var headers = AnthropicCredential.HeadersFor(credential).Append(new("anthropic-version", ApiVersion));
            return await reader.Read("https://api.anthropic.com/v1/models?limit=100", headers);
        }
        catch (ModelCatalogUnavailable exception) when (subscriptionToken)
        {
            var refusedBoth = "a Claude subscription token cannot read Anthropic's model list, and the usage reporting key was refused for it as well "
                + $"({exception.Message.TrimEnd('.')}) - name the models for each tier by hand";
            throw new ModelCatalogUnavailable("Anthropic", refusedBoth);
        }
    }
}

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for OpenAI's public API.
/// </summary>
/// <param name="reader">The <see cref="IModelCatalogReader"/> the catalog is read through.</param>
[Singleton]
public class OpenAIModelListing(IModelCatalogReader reader) : ICanListAvailableModels
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAI;

    /// <inheritdoc/>
    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider) =>
        ProviderCatalogs.HasValue(provider.ApiKey)
            ? reader.Read("https://api.openai.com/v1/models", [ProviderCatalogs.Bearer(provider.ApiKey)])
            : throw new ModelCatalogUnavailable("OpenAI", "the provider has no credential to ask with");
}

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for the authenticated OpenAI Codex surface - which does
/// not publish one.
/// </summary>
/// <remarks>
/// OpenAI's device flow reaches the ChatGPT backend, which exposes no model-list endpoint. This used
/// to answer with a two-name list somebody had typed out, presented as though the vendor had said
/// it; the names were already a release behind. Codex tiers are named by hand, and this says so
/// rather than inventing a catalog (#1187).
/// </remarks>
[Singleton]
public class OpenAICodexModelListing : ICanListAvailableModels
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAICodex;

    /// <inheritdoc/>
    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider) =>
        throw new ModelCatalogUnavailable(
            "OpenAI Codex",
            "the ChatGPT backend publishes no model list - name the models for each tier by hand");
}

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for Z.ai, reached through its Anthropic-compatible
/// surface at the configured endpoint - the same one completions are addressed to, so whatever it
/// lists is what can actually be spent there.
/// </summary>
/// <param name="reader">The <see cref="IModelCatalogReader"/> the catalog is read through.</param>
[Singleton]
public class ZAIModelListing(IModelCatalogReader reader) : ICanListAvailableModels
{
    const string ApiVersion = "2023-06-01";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.ZAI;

    /// <inheritdoc/>
    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider) =>
        ProviderCatalogs.HasValue(provider.Endpoint) && ProviderCatalogs.HasValue(provider.ApiKey)
            ? reader.Read(
                $"{provider.Endpoint.Value.TrimEnd('/')}/v1/models",
                [new("x-api-key", provider.ApiKey.Value), new("anthropic-version", ApiVersion)])
            : throw new ModelCatalogUnavailable("Z.ai", "the provider has no endpoint and credential to ask with");
}

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for an Azure OpenAI deployment - what Azure lists are
/// the tenant's deployment names, which is exactly what a completion addresses a model by there.
/// </summary>
/// <param name="reader">The <see cref="IModelCatalogReader"/> the catalog is read through.</param>
[Singleton]
public class AzureOpenAIModelListing(IModelCatalogReader reader) : ICanListAvailableModels
{
    const string ApiVersion = "2023-03-15-preview";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.AzureOpenAI;

    /// <inheritdoc/>
    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider) =>
        ProviderCatalogs.HasValue(provider.ApiKey) && ProviderCatalogs.HasValue(provider.Endpoint)
            ? reader.Read($"{provider.Endpoint.Value.TrimEnd('/')}/openai/deployments?api-version={ApiVersion}", [new("api-key", provider.ApiKey.Value)])
            : throw new ModelCatalogUnavailable("Azure OpenAI", "the provider has no endpoint and credential to ask with");
}

/// <summary>
/// The <see cref="ICanListAvailableModels"/> for a self-hosted or third-party OpenAI-compatible
/// gateway - asked at <c>{endpoint}/v1/models</c>, with a bearer only when the gateway has a key at
/// all, since local gateways commonly run without one.
/// </summary>
/// <param name="reader">The <see cref="IModelCatalogReader"/> the catalog is read through.</param>
[Singleton]
public class OpenAICompatibleModelListing(IModelCatalogReader reader) : ICanListAvailableModels
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAICompatible;

    /// <inheritdoc/>
    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider) =>
        ProviderCatalogs.HasValue(provider.Endpoint)
            ? reader.Read(
                $"{ProviderCatalogs.OpenAICompatibleBase(provider.Endpoint)}/models",
                ProviderCatalogs.HasValue(provider.ApiKey) ? [ProviderCatalogs.Bearer(provider.ApiKey)] : [])
            : throw new ModelCatalogUnavailable("the gateway", "the provider has no endpoint to ask at");
}

/// <summary>
/// The small helpers the vendor listings share.
/// </summary>
static class ProviderCatalogs
{
    /// <summary>
    /// Whether a concept value carries anything to authenticate or address with.
    /// </summary>
    /// <param name="value">The concept value to check.</param>
    /// <returns><see langword="true"/> when it holds a non-blank value.</returns>
    public static bool HasValue(ConceptAs<string>? value) => !string.IsNullOrWhiteSpace(value?.Value);

    /// <summary>
    /// Builds the bearer authorization header for an API key.
    /// </summary>
    /// <param name="apiKey">The API key.</param>
    /// <returns>The header.</returns>
    public static KeyValuePair<string, string> Bearer(AIProviderApiKey apiKey) => new("Authorization", $"Bearer {apiKey.Value}");

    /// <summary>
    /// Normalizes an OpenAI-compatible endpoint to its <c>/v1</c> base - configured endpoints come
    /// both with and without the suffix.
    /// </summary>
    /// <param name="endpoint">The configured endpoint.</param>
    /// <returns>The base URL ending in <c>/v1</c>.</returns>
    public static string OpenAICompatibleBase(AIProviderEndpoint endpoint)
    {
        var normalized = endpoint.Value.TrimEnd('/');
        return normalized.EndsWith("/v1", StringComparison.OrdinalIgnoreCase) ? normalized : $"{normalized}/v1";
    }
}
