// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// One purpose the seed connects to the seeded provider.
/// </summary>
/// <param name="Purpose">The purpose to serve.</param>
/// <param name="Name">The agent's display name.</param>
/// <param name="Description">What the agent does, in a sentence.</param>
/// <param name="Tier">The capability tier the agent asks for.</param>
public record SeededAgent(LanguageModelPurpose Purpose, string Name, string Description, ModelTier Tier);

/// <summary>
/// Describes an OpenAI provider and the purposes it serves, to be created at startup when it does not
/// exist yet. See <see cref="CratisAIBuilder.SeedOpenAIProvider"/>.
/// </summary>
/// <remarks>
/// The API key comes from the host's configuration, never from source. It is deliberately left out of
/// <see cref="ToString"/> and of every log line the seeding writes.
/// </remarks>
/// <param name="name">The provider's display name. Also the seed's identity: renaming it in code seeds a second provider.</param>
/// <param name="apiKey">The OpenAI API key. When it is null or empty nothing is seeded and a warning is logged.</param>
/// <param name="agents">The purposes to connect to the provider.</param>
/// <param name="tierModels">The models the provider offers per tier - <see langword="null"/> leaves them to the provider's discovered catalog.</param>
public sealed class SeededOpenAIProvider(string name, string? apiKey, IEnumerable<SeededAgent> agents, TierModels? tierModels = null)
{
    /// <summary>
    /// Gets the provider's display name.
    /// </summary>
    public string Name { get; } = name;

    /// <summary>
    /// Gets the API key.
    /// </summary>
    public string ApiKey { get; } = apiKey ?? string.Empty;

    /// <summary>
    /// Gets the purposes connected to the provider.
    /// </summary>
    public IReadOnlyList<SeededAgent> Agents { get; } = [.. agents];

    /// <summary>
    /// Gets the per-tier models, or <see langword="null"/> when none are seeded.
    /// </summary>
    public TierModels? TierModels { get; } = tierModels;

    /// <summary>
    /// Gets the stable identity the provider is created under, derived from <see cref="Name"/>.
    /// </summary>
    public AIProviderId ProviderId => new(new Guid(SHA256.HashData(Encoding.UTF8.GetBytes($"cratis-ai-seed:openai:{Name}")).AsSpan(0, 16)));

    /// <inheritdoc/>
    public override string ToString() => $"OpenAI provider seed '{Name}'";
}
