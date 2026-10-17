// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ClientModel;
using System.ClientModel.Primitives;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.RateLimiting;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

/// <summary>
/// A 429 whose exception message says nothing about quota, but whose response body carries the
/// vendor's own code, is a spent quota rather than throttling (Cratis/AI#569).
/// </summary>
public class and_a_pool_member_response_body_carries_a_quota_code : given.a_pooled_chat_client
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();

    ChatResponse _response;

    void Establish()
    {
        AgentDrawsFromPool(_pool);
        PoolIs(_pool, _first, _second);
        ProviderIs(_first, AIProviderType.Anthropic);
        ProviderIs(_second, AIProviderType.OpenAI);
        _capacities.For(Arg.Any<AIProviderId>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => AIProviderCapacityCalculator.Compute(callInfo.Arg<AIProviderId>(), AIProviderCapacitySource.Unknown, [], null, DateTimeOffset.UtcNow, null, DateTimeOffset.UtcNow, 0.02));

        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns<ChatResponse>(_ => throw new ClientResultException(VendorResponse()));
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "from-openai")));
    }

    async Task Because() => _response = await _client.GetResponseAsync(
        [new(ChatRole.User, "first"), new(ChatRole.Assistant, "reply"), new(ChatRole.User, "second")],
        new ChatOptions { Temperature = 0.25f });

    static PipelineResponse VendorResponse()
    {
        var response = Substitute.For<PipelineResponse>();
        response.Status.Returns(429);
        response.ReasonPhrase.Returns("Too Many Requests");
        response.Content.Returns(BinaryData.FromString("""{"error":{"code":"insufficient_quota"}}"""));
        return response;
    }

    [Fact] void should_answer_from_the_next_member() => _response.Text.ShouldEqual("from-openai");

    [Fact]
    void should_send_the_next_member_the_same_messages_and_options() =>
        _openAIChat.Received(1).GetResponseAsync(
            Arg.Is<IEnumerable<ChatMessage>>(messages => messages.Select(message => message.Text).SequenceEqual(new[] { "first", "reply", "second" })),
            Arg.Is<ChatOptions>(options => options.Temperature == 0.25f),
            Arg.Any<CancellationToken>());

    [Fact] void should_remember_the_failure_against_the_member_out_of_quota() => _failures.Received(1).Record(_first);

    [Fact]
    async Task should_park_the_member_out_of_quota() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordProviderRateLimited>(command => command.Provider == _first));
}
