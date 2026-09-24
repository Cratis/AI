// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Harnesses;
using Cratis.AI.Providers.Copilot;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.HarnessSupport;

/// <summary>
/// The <see cref="IHarnessSupport"/> for GitHub Copilot - the one vendor whose reach is a single
/// harness. The Copilot CLI authenticates against a GitHub account's Copilot entitlement and can
/// talk to nothing else; Claude Code speaks only Anthropic's API, and Pi has no Copilot provider at
/// all (its provider catalog has no entry for one, and a Copilot credential is not an API key any of
/// its providers could send). So a Copilot provider is dispatchable under
/// <see cref="Harness.Copilot"/> and refused under either of the others - refused at dispatch, where
/// the work stays scheduled and the log says why, rather than in a container that 401s against a
/// vendor it was never going to reach (issue #103's lesson, third application).
/// <para>
/// This lives in its own file rather than growing <c>ProviderHarnessSupport.cs</c> past the
/// 200-line guideline, and <c>HarnessCompatibility</c> finds it through
/// <c>IInstancesOf&lt;IHarnessSupport&gt;</c> - nothing in <c>Work</c> changes for a new vendor.
/// </para>
/// </summary>
[Singleton]
public class CopilotHarnessSupport : IHarnessSupport
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.Copilot;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Copilot };

    /// <summary>
    /// Pi has no Copilot provider, so there is no id to return. Reachable only after
    /// <see cref="SupportsCredential"/> has already refused the Pi harness for this vendor, which is
    /// what the dispatcher asks first - the value exists to satisfy the interface, not to be used.
    /// </summary>
    /// <param name="apiKey">The provider's credential, already revealed.</param>
    /// <returns>Nothing usable - see the remarks.</returns>
    public string PiProviderIdFor(AIProviderApiKey apiKey) => string.Empty;

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) =>
        SupportedHarnesses.Contains(harness) && CopilotCredential.IsUsable(apiKey);

    /// <summary>
    /// The highest-precedence of the three variables the Copilot CLI reads
    /// (<c>COPILOT_GITHUB_TOKEN</c>, then <c>GH_TOKEN</c>, then <c>GITHUB_TOKEN</c>). Deliberately
    /// the first: a worker container also carries GitHub credentials for its git operations, and the
    /// account the agent <i>reasons</i> as must not be decided by which of those happens to be set.
    /// </summary>
    /// <param name="harness">The harness the work would run under.</param>
    /// <param name="apiKey">The provider's credential, already revealed.</param>
    /// <returns>The environment variable the credential travels in.</returns>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) => "COPILOT_GITHUB_TOKEN";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) => HarnessSupportVariables.None;
}
