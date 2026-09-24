// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_the_api_rejects_the_credential;

public class the_completion : given.a_client_with_a_stubbed_endpoint
{
    LanguageModelResult _result;

    void Establish() => _statusCode = HttpStatusCode.Unauthorized;

    async Task Because() => _result = await PerformCompletion();

    [Fact] void should_fail() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_be_transient() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_name_the_status_code() => _result.FailureReason.ShouldContain("401");
}
