// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_translating_a_status_code;

/// <summary>
/// One vendor asking for an unreasonable wait must never dominate ManagedLanguageModel's retry
/// budget - capped at TransientProviderFailures.MaxRetryAfter.
/// </summary>
public class and_the_retry_after_exceeds_the_cap : Specification
{
    HttpResponseMessage _response;
    LanguageModelResult _result;

    void Establish()
    {
        _response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
        _response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromMinutes(5));
    }

    void Because() => _result = TransientProviderFailures.FromStatusCode(_response);

    [Fact] void should_cap_the_wait() => _result.RetryAfter.ShouldEqual(TransientProviderFailures.MaxRetryAfter);
}
