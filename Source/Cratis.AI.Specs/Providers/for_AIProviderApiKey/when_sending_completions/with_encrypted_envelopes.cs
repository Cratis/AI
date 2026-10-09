// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Providers.Anthropic;
using Cratis.AI.Providers.AzureOpenAI;
using Cratis.AI.Providers.OpenAI;
using Cratis.AI.Providers.OpenAICompatible;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.ZAI;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_sending_completions;

public class with_encrypted_envelopes : given.outbound_credentials
{
    IAIProviderClient[] _clients = [];
    IClaudeCodeCompletion _claude = null!;

    void Establish()
    {
        var quota = Substitute.For<IAIProviderQuotaTracker>();
        _claude = Substitute.For<IClaudeCodeCompletion>();
        _clients = [
            new AnthropicProviderClient(_http, quota, _claude, Substitute.For<ILogger<AnthropicProviderClient>>()),
            new OpenAIProviderClient(_http, quota, Substitute.For<ILogger<OpenAIProviderClient>>()),
            new AzureOpenAIProviderClient(_http, quota, Substitute.For<ILogger<AzureOpenAIProviderClient>>()),
            new OpenAICompatibleProviderClient(_http, quota, Substitute.For<ILogger<OpenAICompatibleProviderClient>>()),
            new ZAIProviderClient(_http, quota, Substitute.For<ILogger<ZAIProviderClient>>())];
    }

    async Task Because() => _errors = await Task.WhenAll(_clients.SelectMany(client => Envelopes.Select(envelope =>
        Catch.Exception(() => client.Complete("prompt", new ConfiguredAIProvider(AIProviderId.New(), client.Type, envelope) { Endpoint = "https://example.test" }, "model", Effort.Low)))));

    [Fact] void should_require_reconfiguration_for_each_envelope() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
    [Fact] void should_not_send_any_http_request() => _sent.ShouldEqual(0);
    [Fact] async Task should_not_invoke_the_subscription_cli() => await _claude.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}
