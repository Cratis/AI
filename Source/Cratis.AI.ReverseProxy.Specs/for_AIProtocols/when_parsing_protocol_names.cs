// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Protocols.for_AIProtocols;

public class when_parsing_protocol_names : Specification
{
    [Fact] void should_parse_openai() => AIProtocols.Parse(["OpenAI"]).ShouldEqual(AIProtocol.OpenAI);
    [Fact] void should_parse_claude_as_anthropic() => AIProtocols.Parse(["claude"]).ShouldEqual(AIProtocol.Anthropic);
    [Fact] void should_parse_a_separated_list() => AIProtocols.Parse(["openai, anthropic"]).ShouldEqual(AIProtocol.OpenAI | AIProtocol.Anthropic);
    [Fact] void should_ignore_what_it_does_not_know() => AIProtocols.Parse(["grpc"]).ShouldEqual(AIProtocol.None);
    [Fact] void should_name_both_protocols_in_the_form_it_reads_back() => AIProtocols.Names(AIProtocol.OpenAI | AIProtocol.Anthropic).ShouldContainOnly(["openai", "anthropic"]);
}
