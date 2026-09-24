// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Harnesses;
using Cratis.AI.Providers.Anthropic;
using Cratis.AI.Providers.OpenAI;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.HarnessSupport;

/// <summary>
/// The <see cref="IHarnessSupport"/> for Anthropic - both harnesses speak it, but Pi's Anthropic
/// provider authenticates the API-key way only. It sends whatever <c>ANTHROPIC_API_KEY</c> holds as
/// an <c>x-api-key</c> header and has no bearer-token mode, so a subscription OAuth token minted by
/// <c>claude setup-token</c> is rejected with an HTTP 401 that never names the real cause. Refusing
/// the dispatch leaves the work scheduled and says why in the log, which beats a container that
/// burns its retries against an unauthenticated API. An OAuth token is instead handed to the Claude
/// harness as <c>CLAUDE_CODE_OAUTH_TOKEN</c> - putting it in <c>ANTHROPIC_API_KEY</c> makes the CLI
/// send it as an API key, and Anthropic rejects it (issue #103).
/// </summary>
[Singleton]
public class AnthropicHarnessSupport : IHarnessSupport
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.Anthropic;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Claude, Harness.Pi };

    /// <inheritdoc/>
    public string PiProviderIdFor(AIProviderApiKey apiKey) => "anthropic";

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) =>
        SupportedHarnesses.Contains(harness) &&
        !(harness == Harness.Pi && AnthropicCredential.IsOAuthToken(apiKey));

    /// <inheritdoc/>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) =>
        AnthropicCredential.IsOAuthToken(apiKey) ? "CLAUDE_CODE_OAUTH_TOKEN" : "ANTHROPIC_API_KEY";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) => HarnessSupportVariables.None;
}

/// <summary>
/// The <see cref="IHarnessSupport"/> for OpenAI - only Pi speaks it, and it reaches the vendor two
/// different ways depending on the credential.
/// <list type="bullet">
/// <item>
/// An <b>API key</b> runs on Pi's built-in <c>openai</c> provider against <c>api.openai.com</c>,
/// over the vendor-standard <c>OPENAI_API_KEY</c>.
/// </item>
/// <item>
/// A <b>ChatGPT subscription</b> runs on Pi's built-in <c>openai-codex</c> provider against
/// <c>https://chatgpt.com/backend-api</c>. Pi declares that provider itself, with its own OAuth
/// support marked <c>isSubscription: true</c>, so this needs no Pi extension - only the stored OAuth
/// record, which travels as <c>DIRECT_PI_OAUTH_CREDENTIAL</c> and is written into the container's
/// <c>~/.pi/agent/auth.json</c> by <c>entrypoint.sh</c>'s <c>configure_pi_provider</c>. Pi refreshes
/// that credential itself, which is the reason this is the subscription path rather than handing a
/// bare access token to a CLI that cannot renew one.
/// </item>
/// </list>
/// A subscription record that is missing the refresh token or expiry Pi needs is refused here rather
/// than in a container that has already been launched: Pi reports it only as <c>invalid_state</c>,
/// and the work is better left scheduled with the reason in the log.
/// </summary>
[Singleton]
public class OpenAIHarnessSupport : IHarnessSupport
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAI;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Pi };

    /// <inheritdoc/>
    public string PiProviderIdFor(AIProviderApiKey apiKey) =>
        OpenAICredential.IsSubscriptionCredential(apiKey) ? "openai-codex" : "openai";

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) =>
        SupportedHarnesses.Contains(harness) &&
        (!OpenAICredential.IsSubscriptionCredential(apiKey) || OpenAICredential.IsUsableSubscriptionCredential(apiKey));

    /// <inheritdoc/>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) =>
        OpenAICredential.IsSubscriptionCredential(apiKey) ? "DIRECT_PI_OAUTH_CREDENTIAL" : "OPENAI_API_KEY";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) => HarnessSupportVariables.None;
}

/// <summary>
/// The <see cref="IHarnessSupport"/> for OpenAI Codex through a ChatGPT subscription.
/// </summary>
[Singleton]
public class OpenAICodexHarnessSupport : IHarnessSupport
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAICodex;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Pi };

    /// <inheritdoc/>
    public string PiProviderIdFor(AIProviderApiKey apiKey) => "openai-codex";

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) =>
        SupportedHarnesses.Contains(harness) && OpenAICredential.IsUsableSubscriptionCredential(apiKey);

    /// <inheritdoc/>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) => "DIRECT_PI_OAUTH_CREDENTIAL";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) => HarnessSupportVariables.None;
}

/// <summary>
/// The <see cref="IHarnessSupport"/> for an Azure OpenAI deployment - only Pi speaks it, as one of
/// Pi's own built-in providers (<c>pi-ai/dist/providers/data/azure-openai-responses.json</c>), over
/// the vendor-standard <c>AZURE_OPENAI_API_KEY</c>.
/// </summary>
[Singleton]
public class AzureOpenAIHarnessSupport : IHarnessSupport
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.AzureOpenAI;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Pi };

    /// <inheritdoc/>
    public string PiProviderIdFor(AIProviderApiKey apiKey) => "azure-openai-responses";

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) => SupportedHarnesses.Contains(harness);

    /// <inheritdoc/>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) => "AZURE_OPENAI_API_KEY";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) => HarnessSupportVariables.None;
}

/// <summary>
/// The <see cref="IHarnessSupport"/> for a self-hosted or third-party OpenAI-compatible gateway -
/// only Pi speaks it, declared as a custom provider in a generated <c>models.json</c> (see
/// <c>Source/AgentHarnesses/entrypoint.sh</c>'s <c>configure_pi_provider</c>) under the id
/// <c>direct-openai-compatible</c>, which must stay in lockstep with <see cref="PiProviderIdFor"/>.
/// The gateway is not a real vendor and has no vendor-standard key variable, so it gets a
/// Direct-defined one instead.
/// </summary>
[Singleton]
public class OpenAICompatibleHarnessSupport : IHarnessSupport
{
    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAICompatible;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Pi };

    /// <inheritdoc/>
    public string PiProviderIdFor(AIProviderApiKey apiKey) => "direct-openai-compatible";

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) => SupportedHarnesses.Contains(harness);

    /// <inheritdoc/>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) => "DIRECT_PROVIDER_API_KEY";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) => HarnessSupportVariables.None;
}

/// <summary>
/// The <see cref="IHarnessSupport"/> for Z.ai's GLM API - an Anthropic-compatible endpoint that both
/// harnesses speak natively, each in its own shape:
/// <list type="bullet">
/// <item>
/// The <b>Claude harness</b> points the Claude CLI at Z.ai's Anthropic surface with
/// <c>ANTHROPIC_BASE_URL</c> and authenticates with <c>ANTHROPIC_AUTH_TOKEN</c> - the CLI's bearer
/// header for gateway-style keys, not the <c>x-api-key</c> slot a first-party Anthropic key uses.
/// The GLM models answer long agentic requests, so the CLI's default two-minute request timeout
/// cuts real sessions off; Z.ai's own setup guide sets <c>API_TIMEOUT_MS</c> to ten minutes.
/// </item>
/// <item>
/// The <b>Pi harness</b> uses Pi's built-in <c>zai</c> provider over its native
/// <c>ZAI_API_KEY</c>. Pi declares that provider itself, fixed to Z.ai's public endpoint, so the
/// configured endpoint is not handed to the Pi path - there is no environment variable for it, and
/// Pi's provider id carries nothing to override it with.
/// </item>
/// </list>
/// </summary>
[Singleton]
public class ZAIHarnessSupport : IHarnessSupport
{
    /// <summary>
    /// The base URL Z.ai documents for Claude Code, when the provider carries none of its own - a
    /// deployment pointed at Z.ai's coding-plan endpoint can set it explicitly.
    /// </summary>
    public const string DefaultEndpoint = "https://api.z.ai/api/anthropic";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.ZAI;

    /// <inheritdoc/>
    public IReadOnlySet<Harness> SupportedHarnesses { get; } = new HashSet<Harness> { Harness.Claude, Harness.Pi };

    /// <inheritdoc/>
    public string PiProviderIdFor(AIProviderApiKey apiKey) => "zai";

    /// <inheritdoc/>
    public bool SupportsCredential(Harness harness, AIProviderApiKey apiKey) => SupportedHarnesses.Contains(harness);

    /// <inheritdoc/>
    public string ApiKeyVariableFor(Harness harness, AIProviderApiKey apiKey) =>
        harness == Harness.Pi ? "ZAI_API_KEY" : "ANTHROPIC_AUTH_TOKEN";

    /// <inheritdoc/>
    public IReadOnlyDictionary<string, string> VariablesFor(Harness harness, AIProviderEndpoint? endpoint) =>
        harness == Harness.Pi
            ? HarnessSupportVariables.None
            : new Dictionary<string, string>
            {
                ["ANTHROPIC_BASE_URL"] = endpoint is { } value && value != AIProviderEndpoint.NotSet ? value.Value : DefaultEndpoint,
                ["API_TIMEOUT_MS"] = "3000000"
            };
}
