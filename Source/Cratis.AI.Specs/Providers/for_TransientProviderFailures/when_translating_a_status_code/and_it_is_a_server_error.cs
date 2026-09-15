// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_translating_a_status_code;

/// <summary>
/// A 5xx is the vendor's own problem, not the request's - worth another attempt.
/// </summary>
public class and_it_is_a_server_error : Specification
{
    LanguageModelResult _result;

    void Because() => _result = TransientProviderFailures.FromStatusCode(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));

    [Fact] void should_be_transient() => _result.IsTransient.ShouldBeTrue();
}
