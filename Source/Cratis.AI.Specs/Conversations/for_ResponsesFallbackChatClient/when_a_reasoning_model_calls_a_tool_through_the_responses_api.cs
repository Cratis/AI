// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ClientModel;
using System.ClientModel.Primitives;
using System.Text;
using Microsoft.Extensions.AI;
using OpenAI;
using OpenAI.Responses;

namespace Cratis.AI.Conversations.for_ResponsesFallbackChatClient;

// What goes over the wire to /v1/responses for a model that reasons and calls a tool: the call is served at all, the tool
// is offered, and the second turn continues the first response by id instead of replaying its items - the server keeps the
// reasoning, so a reasoning model is never handed a function call without the reasoning item it belongs to.
public class when_a_reasoning_model_calls_a_tool_through_the_responses_api : Specification
{
    const string FirstTurn = """{"id":"resp_1","object":"response","created_at":1,"status":"completed","model":"gpt-6.2-sol","output":[{"type":"reasoning","id":"rs_1","summary":[]},{"type":"function_call","id":"fc_1","call_id":"call_1","name":"read-workspace","arguments":"{}","status":"completed"}],"parallel_tool_calls":true,"tool_choice":"auto","tools":[]}""";

    const string SecondTurn = """{"id":"resp_2","object":"response","created_at":2,"status":"completed","model":"gpt-6.2-sol","output":[{"type":"message","id":"msg_1","status":"completed","role":"assistant","content":[{"type":"output_text","text":"done","annotations":[]}]}],"parallel_tool_calls":true,"tool_choice":"auto","tools":[]}""";

    readonly List<(string Path, string Body)> _requests = [];
    ChatResponse _response;

    async Task Because()
    {
        var answers = new Queue<string>([FirstTurn, SecondTurn]);
        var transport = new HttpClientPipelineTransport(new HttpClient(new Recording(answers, _requests)));
#pragma warning disable OPENAI001
        var responses = new ResponsesClient(new ApiKeyCredential("not-a-key"), new ResponsesClientOptions { Transport = transport }).AsIChatClient("gpt-6.2-sol");
#pragma warning restore OPENAI001
        using var client = new ChatClientBuilder(responses).UseFunctionInvocation().Build();
        var tool = AIFunctionFactory.Create(() => "the workspace", "read-workspace");

        _response = await client.GetResponseAsync([new ChatMessage(ChatRole.User, "look")], new ChatOptions { Tools = [tool] });
    }

    [Fact] void should_answer() => _response.Text.ShouldEqual("done");
    [Fact] void should_call_the_responses_api() => _requests.Select(request => request.Path).ShouldEqual(["/v1/responses", "/v1/responses"]);
    [Fact] void should_offer_the_tool() => _requests[0].Body.ShouldContain("\"name\":\"read-workspace\"");
    [Fact] void should_hand_the_function_result_back() => _requests[1].Body.ShouldContain("function_call_output");
    [Fact] void should_continue_the_first_response_so_the_server_keeps_the_reasoning() => _requests[1].Body.ShouldContain("\"previous_response_id\":\"resp_1\"");
    [Fact] void should_answer_the_call_it_was_given() => _requests[1].Body.ShouldContain("\"call_id\":\"call_1\"");

    sealed class Recording(Queue<string> answers, List<(string Path, string Body)> requests) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            requests.Add((request.RequestUri!.AbsolutePath, await request.Content!.ReadAsStringAsync(cancellationToken)));
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(answers.Dequeue(), Encoding.UTF8, "application/json") };
        }
    }
}
