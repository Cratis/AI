// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Endpoints.for_ModelEndpoints;

public class when_changing_endpoints : Specification
{
    ModelEndpoints _endpoints;
    ModelEndpoint _first;
    int _changes;
    ModelEndpoint _winner;
    Exception _invalid;

    void Establish()
    {
        _endpoints = new();
        _first = new("b-host", "B", "http://b:1", AIProtocol.OpenAI, [new("llama3")]);
    }

    void Because()
    {
        Watch();
        _endpoints.Set(_first);
        _endpoints.Set(new("a-host", "A", "http://a:1", AIProtocol.OpenAI, [new("llama3")]));
        _endpoints.Set(new("a-host", "A", "http://a:1", AIProtocol.OpenAI, [new("llama3")]));
        _winner = _endpoints.FindForModel("LLAMA3", AIProtocol.OpenAI);
        _invalid = Catch.Exception(() => _endpoints.Set(new("Bad Id", "x", "http://x", AIProtocol.OpenAI, [])));
    }

    void Watch() => Microsoft.Extensions.Primitives.ChangeToken.OnChange(_endpoints.GetChangeToken, () => _changes++);

    [Fact] void should_signal_each_real_change_once() => _changes.ShouldEqual(2);
    [Fact] void should_not_signal_when_nothing_differs() => _changes.ShouldBeLessThan(3);
    [Fact] void should_pick_the_lowest_identity_when_two_serve_a_model() => _winner.Id.ShouldEqual("a-host");
    [Fact] void should_find_a_model_ignoring_case() => _winner.ShouldNotBeNull();
    [Fact] void should_not_find_a_model_over_a_protocol_the_endpoint_lacks() => _endpoints.FindForModel("llama3", AIProtocol.Anthropic).ShouldBeNull();
    [Fact] void should_refuse_an_identity_that_is_not_a_dns_label() => _invalid.ShouldBeOfExactType<ArgumentException>();
}
