// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.AspNetCore.Http;

namespace Planner.Work.Authorizing.for_BearerToken.when_reading_the_presented_token;

public class and_nothing_was_presented : Specification
{
    HttpRequest _request;
    WorkToken _result;

    void Establish() => _request = new DefaultHttpContext().Request;

    void Because() => _result = BearerToken.From(_request);

    [Fact]
    void should_read_no_token() => _result.ShouldEqual(WorkToken.NotSet);
}
#endif
