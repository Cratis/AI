// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Harnesses;
namespace Cratis.AI.Providers.HarnessSupport;

/// <summary>
/// Declares which <see cref="Harness"/> instances one <see cref="AIProviderType"/> can be dispatched
/// under, and how a worker container authenticates against it - one implementation per vendor,
/// discovered by convention, mirroring <c>IAIProviderClient</c> and <c>ICanListAvailableModels</c>.
/// The capability the harness needs (whether it can run at all, and whether it can use the specific
/// credential revealed) is asked here rather than switched on in <c>Work</c>, so a new vendor needs
/// no changes outside its own implementation.
/// </summary>
public interface IHarnessSupport
{
    /// <summary>
    /// Gets the vendor this capability describes.
    /// </summary>
    AIProviderType Type { get; }

    /// <summary>
    /// Gets the harnesses that can dispatch against this vendor at all.
    /// </summary>
    IReadOnlySet<Harness> SupportedHarnesses { get; }

    /// <summary>
    /// The provider id Pi's own <c>--provider</c> flag knows this vendor by, which for OpenAI
    /// depends on the credential: an API key runs on Pi's <c>openai</c> provider against
    /// <c>api.openai.com</c>, while a ChatGPT subscription runs on its <c>openai-codex</c> one
    /// against the ChatGPT backend. Same vendor, same models, two different endpoints and two
    /// different ways of authenticating - so the credential decides, exactly as it already does for
    /// <see cref="ApiKeyVariableFor(Harness, AIProviderApiKey)"/>.
    /// </summary>
    /// <param name="apiKey">The provider's credential, already revealed.</param>
    /// <returns>The Pi provider id.</returns>
    string PiProviderIdFor(AIProviderApiKey apiKey);

    /// <summary>
    /// Whether a harness can authenticate with the specific credential the provider holds, on top of
    /// whether it can run against the vendor at all.
    /// </summary>
    /// <param name="harness">The harness the work would run under.</param>
    /// <param name="apiKey">The provider's credential, already revealed.</param>
    /// <returns><see langword="true"/> when the combination is dispatchable.</returns>
    bool SupportsCredential(Harness harness, AIProviderApiKey apiKey);

    /// <summary>
    /// The environment variable the credential actually travels in for the given harness dispatch.
    /// A vendor can authenticate its two harnesses differently - Z.ai's Claude-harness sessions go
    /// through the Claude CLI's <c>ANTHROPIC_AUTH_TOKEN</c> bearer slot, its Pi sessions through
    /// Pi's native <c>ZAI_API_KEY</c> - which is why the harness is part of the question.
    /// </summary>
    /// <param name="harness">The harness the work would run under.</param>
    /// <param name="apiKey">The provider's credential, already revealed.</param>
    /// <returns>The variable name.</returns>
    string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey);

    /// <summary>
    /// The non-secret environment variables this vendor's dispatch needs beyond the credential
    /// variable, keyed by variable name. A vendor whose harnesses reach it through different
    /// protocol shapes has to hand each one its own variables - Z.ai's Anthropic-compatible
    /// endpoint reaches the Claude CLI as <c>ANTHROPIC_BASE_URL</c> (with the long-request timeout
    /// its GLM models need), while Pi's own Z.ai provider needs nothing beyond its key.
    /// </summary>
    /// <param name="harness">The harness the work would run under.</param>
    /// <param name="endpoint">The provider's configured endpoint, when it carries one.</param>
    /// <returns>The variables to add to the worker's environment.</returns>
    IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint);
}

/// <summary>
/// Variables every <see cref="IHarnessSupport"/> without extra dispatch-time environment hands back.
/// </summary>
public static class HarnessSupportVariables
{
    /// <summary>
    /// The empty variable set - the common case: the credential variable is all a dispatch needs.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> None = new Dictionary<string, string>();
}
