// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Endpoints.for_ModelEndpoints;

public class when_normalizing_a_base_address : Specification
{
    [Fact] void should_drop_a_trailing_slash() => ModelEndpoint.NormalizeBaseAddress("http://localhost:11434/").ShouldEqual("http://localhost:11434");
    [Fact] void should_drop_a_trailing_v1_because_requests_carry_it() => ModelEndpoint.NormalizeBaseAddress("http://localhost:1234/v1").ShouldEqual("http://localhost:1234");
    [Fact] void should_drop_both() => ModelEndpoint.NormalizeBaseAddress(" http://localhost:1234/v1/ ").ShouldEqual("http://localhost:1234");
    [Fact] void should_keep_a_path_that_is_not_v1() => ModelEndpoint.NormalizeBaseAddress("http://host/gateway").ShouldEqual("http://host/gateway");
}
