// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_AIProviderQuotaHeaders.when_reading;

public class and_the_vendor_sent_no_recognized_headers : Specification
{
    AIProviderQuotaStatus? _status;

    void Because()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.OK);
        _status = AIProviderQuotaHeaders.Read(AIProviderType.OpenAICompatible, response);
    }

    [Fact] void should_read_nothing() => _status.ShouldBeNull();
}
