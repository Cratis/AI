// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeResponse;

public class when_reading_a_completed_analysis : Specification
{
    LanguageModelResult _result = null!;

    void Because()
    {
        const string envelope = """
            {"is_error":false,"subtype":"success","result":"The analysis","usage":{"input_tokens":3,"cache_creation_input_tokens":40,"cache_read_input_tokens":20,"output_tokens":5}}
            """;
        _result = ClaudeCodeResponse.Read(new(0, envelope), "claude-sonnet-4-6");
    }

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_return_the_analysis() => _result.Text.ShouldEqual("The analysis");
    [Fact] void should_report_the_fresh_input_tokens() => _result.Usage!.InputTokens.ShouldEqual(new InputTokens(3));

    // Cache reads and cache writes are billed differently from fresh input, so they are reported on
    // their own rather than summed into the input count.
    [Fact] void should_report_the_cached_tokens_separately() => _result.Usage!.CachedTokens.ShouldEqual(new CachedTokens(60));
    [Fact] void should_not_invent_cost() => _result.Usage!.CostUsd.ShouldBeNull();
    [Fact] void should_record_output() => _result.Usage!.OutputTokens.ShouldEqual(new OutputTokens(5));
}
