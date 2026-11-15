// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_streaming_a_response : given.a_proxy_in_front_of_a_backend
{
    List<string> _lines;
    string _contentType;

    async Task Because()
    {
        _lines = [];
        using var response = await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"llama3","stream":true}""", true, ("x-stream", "1")), HttpCompletionOption.ResponseHeadersRead);
        _contentType = response.Content.Headers.ContentType?.MediaType;
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        while (await reader.ReadLineAsync() is { } line)
        {
            if (line.Length > 0)
            {
                _lines.Add(line);
            }
        }
    }

    [Fact] void should_keep_the_event_stream_content_type() => _contentType.ShouldEqual("text/event-stream");
    [Fact] void should_deliver_every_event_in_order() => string.Join(',', _lines).ShouldEqual("data: one,data: two,data: [DONE]");
}
