// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamEvent.when_parsing;

public class with_aggregate_model_usage : Specification
{
    ClaudeCodeStreamEvent _event = null!;
    bool _recognized;

    void Because() => _recognized = ClaudeCodeStreamEvent.TryParse("""{"type":"result","subtype":"success","result":"done","stop_reason":"max_tokens","usage":{"input_tokens":999},"modelUsage":{"sonnet":{"inputTokens":10,"outputTokens":5,"cacheReadInputTokens":3,"cacheCreationInputTokens":2,"costUSD":0.1},"opus":{"inputTokens":20,"outputTokens":7,"cacheReadInputTokens":4,"cacheCreationInputTokens":1,"costUSD":0.2}}}""", out _event);

    [Fact] void should_recognize_the_event() => _recognized.ShouldBeTrue();
    [Fact] void should_aggregate_all_models() => _event.Usage!.InputTokenCount.ShouldEqual(40);
    [Fact] void should_sum_output() => _event.Usage!.OutputTokenCount.ShouldEqual(12);
    [Fact] void should_count_only_reads_as_cached_input() => _event.Usage!.CachedInputTokenCount.ShouldEqual(7);
    [Fact] void should_report_creation_separately() => _event.Usage!.AdditionalCounts!["cache_creation_input_tokens"].ShouldEqual(3);
    [Fact] void should_sum_cost_without_a_total() => _event.CostUsd.ShouldEqual(0.3m);
    [Fact] void should_use_the_vendor_stop_reason() => _event.FinishReason.ShouldEqual(ChatFinishReason.Length);
}
