// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.OpenAI;
using Cratis.Execution;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials;

public class when_recording_the_credential_is_refused : given.all_dependencies
{
    AIProviderApiKey? _result;

    void Establish()
    {
        var refreshed = new OpenAISubscriptionCredential("new-access", "new-refresh", _now.AddHours(8).ToUnixTimeMilliseconds(), "acct");
        _tokens.Refresh(Arg.Any<OpenAISubscriptionCredential>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<OpenAISubscriptionCredential?>(refreshed));
        _commandPipeline.Execute(Arg.Any<RecordRefreshedOpenAISubscription>())
            .Returns(CommandResult.Unauthorized(CorrelationId.New()));
    }

    async Task Because() => _result = await _credentials.EnsureCurrent(_provider, CredentialExpiringIn(TimeSpan.FromMinutes(1)));

    [Fact] void should_not_return_the_unrecorded_credential() => _result.ShouldBeNull();
    [Fact] void should_attempt_to_record_the_credential() => _commandPipeline.Received(1).Execute(Arg.Any<RecordRefreshedOpenAISubscription>());
}
