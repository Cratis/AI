// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.DependencyInjection;

namespace Cratis.AI.Agents;

/// <summary>
/// Resolves the provider capabilities required by an agent purpose.
/// </summary>
public interface IAgentCapabilityRequirements
{
    /// <summary>
    /// Gets the invocation mode declared for an agent purpose.
    /// </summary>
    /// <param name="purpose">The agent purpose.</param>
    /// <returns>The invocation mode.</returns>
    AgentInvocationMode ModeFor(LanguageModelPurpose purpose);

    /// <summary>
    /// Gets the provider capabilities required by an agent purpose.
    /// </summary>
    /// <param name="purpose">The agent purpose.</param>
    /// <returns>The required capabilities.</returns>
    IReadOnlySet<AIProviderCapability> For(LanguageModelPurpose purpose);
}

/// <summary>
/// Checks whether an AI provider can serve an agent purpose.
/// </summary>
public interface IAgentProviderCompatibility
{
    /// <summary>
    /// Determines whether a provider can serve the agent purpose.
    /// </summary>
    /// <param name="purpose">The agent purpose.</param>
    /// <param name="providerType">The provider type.</param>
    /// <returns><see langword="true"/> when the provider satisfies every requirement.</returns>
    bool Supports(LanguageModelPurpose purpose, AIProviderType providerType);
}

/// <summary>
/// Derives agent requirements from what the application says a purpose is invoked as.
/// </summary>
/// <param name="defaultModes">Says what a purpose is invoked as when no agent claims it.</param>
[Singleton]
public class AgentCapabilityRequirements(IDefaultAgentInvocationModes defaultModes) : IAgentCapabilityRequirements
{
    static readonly IReadOnlySet<AIProviderCapability> _conversational = new HashSet<AIProviderCapability>
    {
        AIProviderCapability.Conversational,
    };

    static readonly IReadOnlySet<AIProviderCapability> _agentic = new HashSet<AIProviderCapability>
    {
        AIProviderCapability.Agentic,
    };

    /// <inheritdoc/>
    public AgentInvocationMode ModeFor(LanguageModelPurpose purpose) => defaultModes.For(purpose);

    /// <inheritdoc/>
    public IReadOnlySet<AIProviderCapability> For(LanguageModelPurpose purpose) =>
        ModeFor(purpose) == AgentInvocationMode.Job ? _agentic : _conversational;
}

/// <summary>
/// Compares the authoritative agent requirements with provider capability descriptors.
/// </summary>
/// <param name="requirements">The agent requirement catalog.</param>
[Singleton]
public class AgentProviderCompatibility(IAgentCapabilityRequirements requirements) : IAgentProviderCompatibility
{
    /// <inheritdoc/>
    public bool Supports(LanguageModelPurpose purpose, AIProviderType providerType) =>
        AIProviderCapabilities.Supports(providerType, requirements.For(purpose));
}
