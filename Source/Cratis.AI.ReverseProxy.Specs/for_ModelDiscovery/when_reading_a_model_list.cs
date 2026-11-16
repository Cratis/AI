// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Discovery.for_ModelDiscovery;

public class when_reading_a_model_list : Specification
{
    DiscoveryResult _openAI;
    DiscoveryResult _anthropic;
    DiscoveryResult _ollama;
    DiscoveryResult _garbage;

    void Because()
    {
        _openAI = ModelDiscovery.ParseListing("""{"object":"list","data":[{"id":"llama3","object":"model","context_length":8192},{"id":"qwen"}]}""");
        _anthropic = ModelDiscovery.ParseListing("""{"data":[{"type":"model","id":"claude-x","display_name":"Claude X"}],"has_more":false}""");
        _ollama = ModelDiscovery.ParseOllamaTags("""{"models":[{"name":"llama3:8b"},{"name":"phi3"}]}""");
        _garbage = ModelDiscovery.ParseListing("<html>nope</html>");
    }

    [Fact] void should_find_the_openai_models() => _openAI.Models.Select(model => model.Name).ShouldContainOnly(["llama3", "qwen"]);
    [Fact] void should_say_it_speaks_openai() => _openAI.Protocols.ShouldEqual(AIProtocol.OpenAI);
    [Fact] void should_read_the_context_window_when_the_server_reports_it() => _openAI.Models[0].ContextWindow.ShouldEqual(8192);
    [Fact] void should_recognize_an_anthropic_list() => _anthropic.Protocols.ShouldEqual(AIProtocol.Anthropic);
    [Fact] void should_read_the_anthropic_display_name() => _anthropic.Models[0].DisplayName.ShouldEqual("Claude X");
    [Fact] void should_read_ollamas_native_tags() => _ollama.Models.Select(model => model.Name).ShouldContainOnly(["llama3:8b", "phi3"]);
    [Fact] void should_not_mistake_a_web_page_for_a_model_list() => _garbage.ShouldBeNull();
}
