// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Protocols.for_AIProtocols;

public class when_detecting_the_protocol : Specification
{
    [Fact] void should_know_chat_completions_is_openai() => AIProtocols.Detect("/v1/chat/completions", false).ShouldEqual(AIProtocol.OpenAI);
    [Fact] void should_know_embeddings_is_openai() => AIProtocols.Detect("/v1/embeddings", false).ShouldEqual(AIProtocol.OpenAI);
    [Fact] void should_know_messages_is_anthropic() => AIProtocols.Detect("/v1/messages", false).ShouldEqual(AIProtocol.Anthropic);
    [Fact] void should_ignore_a_trailing_slash() => AIProtocols.Detect("/v1/messages/", false).ShouldEqual(AIProtocol.Anthropic);
    [Fact] void should_treat_a_model_listing_with_the_version_header_as_anthropic() => AIProtocols.Detect("/v1/models", true).ShouldEqual(AIProtocol.Anthropic);
    [Fact] void should_treat_a_model_listing_without_it_as_openai() => AIProtocols.Detect("/v1/models", false).ShouldEqual(AIProtocol.OpenAI);
    [Fact] void should_refuse_a_backend_management_path() => AIProtocols.Detect("/api/pull", false).ShouldEqual(AIProtocol.None);
    [Fact] void should_refuse_an_unknown_v1_path() => AIProtocols.Detect("/v1/files", false).ShouldEqual(AIProtocol.None);
}
