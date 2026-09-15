// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration;

/// <summary>
/// Registers <c>Cratis.AI</c> into an <see cref="IServiceCollection"/>.
/// </summary>
public static class CratisAIServiceCollectionExtensions
{
    /// <summary>
    /// Adds <c>Cratis.AI</c>.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configure">Callback for supplying the seams the package needs - secret protection and an agent lookup are required.</param>
    /// <returns>The <see cref="IServiceCollection"/> for continuation.</returns>
    /// <remarks>
    /// <para>
    /// <b>Must be called before <c>AddCratisArc()</c> and <c>AddChronicle()</c>.</b> Arc's type discovery
    /// snapshots the type universe the first time <c>Types.Instance</c> is touched, from whichever
    /// assemblies had already run their module initializers by that point - a lazily-loaded
    /// <c>Cratis.AI.dll</c> loaded afterwards contributes nothing, silently (plan Section 12.2 step 3).
    /// Calling this first forces the CLR to load the assembly - which runs its module initializer,
    /// which registers its type-discovery provider - before anything else can take that snapshot.
    /// </para>
    /// <code>
    /// builder.Services.AddCratisAI(ai => ai
    ///     .WithSecretProtection&lt;OrganizationSecretProtector&gt;()
    ///     .WithAgents&lt;OrganizationAgents&gt;());
    /// builder.AddCratisArc();
    /// builder.AddChronicle();
    /// </code>
    /// </remarks>
    /// <exception cref="CratisAIOrderingViolation">
    /// Thrown when the sentinel type cannot be found in the type universe immediately after
    /// registration - see <see cref="CratisAISentinel"/>. A hard startup failure here beats a
    /// projection or event type that silently never runs.
    /// </exception>
    public static IServiceCollection AddCratisAI(this IServiceCollection services, Action<CratisAIBuilder> configure)
    {
        var builder = new CratisAIBuilder(services);

        // No-op defaults for the optional seams, registered first so an explicit WithAlerts/
        // WithUsageAttribution call in `configure` overrides them (TryAdd* below keeps the earliest
        // registration when nothing does).
        services.AddSingleton<IAIAlerts, NoOpAIAlerts>();
        services.AddSingleton<IAIUsageAttribution, NoAttributionAIUsageAttribution>();

        configure(builder);

        services.AddSingleton<IAgentExecution, AgentExecution>();

        AssertLoadedIntoTypeUniverse();

        return services;
    }

    /// <summary>
    /// Forces the assembly to load without registering anything - for a consumer that wants the
    /// ordering guarantee without adopting the rest of the package yet. See <see cref="AddCratisAI"/>.
    /// </summary>
    public static void EnsureLoaded() => AssertLoadedIntoTypeUniverse();

    static void AssertLoadedIntoTypeUniverse()
    {
        if (!Cratis.Types.Types.Instance.All.Contains(typeof(CratisAISentinel)))
        {
            throw new CratisAIOrderingViolation();
        }
    }
}
