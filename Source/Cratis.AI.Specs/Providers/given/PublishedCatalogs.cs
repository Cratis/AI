// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Representative model catalogs for the vendors specs dispatch against - what a provider looks like
/// once its registration discovery has run, which is the ordinary state of a configured provider
/// (#1187).
/// </summary>
/// <remarks>
/// Every spec that dispatches through a tier needs the provider to have published something, because
/// a tier no longer resolves through a table of model names Direct carries around. Keeping the
/// catalogs here rather than inline in each spec keeps them recognizable as vendor answers rather
/// than as expectations, and keeps a change of vendor shape a one-file edit.
/// </remarks>
public static class PublishedCatalogs
{
    /// <summary>
    /// The catalog a vendor of this type publishes in specs.
    /// </summary>
    /// <param name="type">The vendor.</param>
    /// <returns>The catalog - empty for vendors that publish none.</returns>
    public static IEnumerable<ModelName> For(AIProviderType type) => type switch
    {
        AIProviderType.Anthropic =>
        [
            new ModelName("claude-opus-4-5"),
            new ModelName("claude-sonnet-4-5"),
            new ModelName("claude-haiku-4-5"),
        ],
        AIProviderType.OpenAI =>
        [
            new ModelName("gpt-5.2"),
            new ModelName("gpt-5-mini"),
        ],
        AIProviderType.ZAI =>
        [
            new ModelName("glm-5.3"),
            new ModelName("glm-5.3-flash"),
        ],
        _ => [],
    };
}
