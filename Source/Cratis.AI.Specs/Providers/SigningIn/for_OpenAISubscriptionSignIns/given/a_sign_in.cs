// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.OpenAI;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.SigningIn.for_OpenAISubscriptionSignIns.given;

public class a_sign_in : SigningIn.given.a_detached_sign_in
{
    protected OpenAISubscriptionSignInStarted? _started;
    protected bool _pollingFails;
    protected readonly OpenAISubscriptionCredential _credential = new("access", "refresh", DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeMilliseconds(), "account");
    OpenAISubscriptionSignIns _signIns;

    void Establish()
    {
        _current = new(_provider, AIProviderType.OpenAICodex, AIProviderApiKey.NotSet);
        var tokens = Substitute.For<IOpenAISubscriptionTokens>();
        tokens.BeginDeviceSignIn().Returns(new OpenAIDeviceAuthorization("device", "code", 0));
        tokens.CompleteDeviceSignIn(Arg.Any<OpenAIDeviceAuthorization>()).Returns(async _ =>
        {
            await _release.Task;
            if (_pollingFails)
            {
                throw new InvalidOperationException("Polling failed");
            }

            return (OpenAISubscriptionCredential?)_credential;
        });
        _signIns = new(tokens, _client, _options, _tenants, Substitute.For<ILogger<OpenAISubscriptionSignIns>>());
    }

    protected Task SignIn() => RunDetached(async () => _started = await _signIns.Begin(_provider));
}
