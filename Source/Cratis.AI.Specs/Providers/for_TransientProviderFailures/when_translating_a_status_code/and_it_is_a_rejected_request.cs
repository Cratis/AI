// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_translating_a_status_code;

/// <summary>
/// A 4xx that is not a rate limit (bad credentials, a rejected request, an unknown model) can never
/// be fixed by retrying.
/// </summary>
public class and_it_is_a_rejected_request : Specification
{
    LanguageModelResult _result;

    void Because() => _result = TransientProviderFailures.FromStatusCode(new HttpResponseMessage(HttpStatusCode.Unauthorized));

    [Fact] void should_not_be_transient() => _result.IsTransient.ShouldBeFalse();
}
