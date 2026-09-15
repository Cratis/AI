// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_translating_a_status_code;

/// <summary>
/// A 429 is worth retrying - the vendor is saying "not now", not "never".
/// </summary>
public class and_it_is_rate_limited : Specification
{
    HttpResponseMessage _response;
    LanguageModelResult _result;

    void Establish()
    {
        _response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
        _response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(3));
    }

    void Because() => _result = TransientProviderFailures.FromStatusCode(_response);

    [Fact] void should_not_have_succeeded() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_be_transient() => _result.IsTransient.ShouldBeTrue();
    [Fact] void should_honor_the_vendors_retry_after() => _result.RetryAfter.ShouldEqual(TimeSpan.FromSeconds(3));
}
