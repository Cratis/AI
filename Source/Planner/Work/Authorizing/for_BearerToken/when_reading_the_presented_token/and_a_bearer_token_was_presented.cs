// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.AspNetCore.Http;

namespace Planner.Work.Authorizing.for_BearerToken.when_reading_the_presented_token;

public class and_a_bearer_token_was_presented : Specification
{
    HttpRequest _request;
    WorkToken _result;

    void Establish()
    {
        _request = new DefaultHttpContext().Request;
        _request.Headers[BearerToken.Header] = "Bearer VGhlLXRva2Vu";
    }

    void Because() => _result = BearerToken.From(_request);

    [Fact]
    void should_read_the_token() => _result.ShouldEqual(new WorkToken("VGhlLXRva2Vu"));
}
#endif
