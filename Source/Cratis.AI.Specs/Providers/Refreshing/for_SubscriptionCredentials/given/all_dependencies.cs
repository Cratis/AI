// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Providers.OpenAI;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials.given;

public class all_dependencies : Specification
{
    protected SubscriptionCredentials _credentials;
    protected IOpenAISubscriptionTokens _tokens;
    protected ICommandPipeline _commandPipeline;
    protected IAIAlerts _alerts;
    protected AIProviderOptions _options;
    protected AIProviderId _provider;

    protected static readonly DateTimeOffset _now = DateTimeOffset.UtcNow;

    /// <summary>
    /// A stored credential expiring at a given distance from now.
    /// </summary>
    /// <param name="expiresIn">How much life it has left.</param>
    /// <returns>The stored form.</returns>
    protected static AIProviderApiKey CredentialExpiringIn(TimeSpan expiresIn) =>
        new OpenAISubscriptionCredential("access", "refresh", _now.Add(expiresIn).ToUnixTimeMilliseconds(), "acct").ToApiKey();

    void Establish()
    {
        _provider = AIProviderId.New();
        _tokens = Substitute.For<IOpenAISubscriptionTokens>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _alerts = Substitute.For<IAIAlerts>();
        _options = new AIProviderOptions();
        _credentials = new(_tokens, _commandPipeline, _alerts, Options.Create(_options), Substitute.For<Microsoft.Extensions.Logging.ILogger<SubscriptionCredentials>>());
    }
}
