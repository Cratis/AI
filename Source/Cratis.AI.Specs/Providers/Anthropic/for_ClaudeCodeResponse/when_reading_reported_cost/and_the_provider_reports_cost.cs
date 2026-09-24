// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeResponse.when_reading_reported_cost;

public class and_the_provider_reports_cost : Specification
{
    LanguageModelResult _result;

    void Because()
    {
        const string envelope = """
        {"is_error":false,"subtype":"success","result":"answer","total_cost_usd":0.123456,"usage":{"input_tokens":3,"cache_creation_input_tokens":40,"cache_read_input_tokens":20,"output_tokens":5},"modelUsage":{"model":{"costUSD":0.123456}}}
        """;
        _result = ClaudeCodeResponse.Read(new(0, envelope), "model");
    }

    [Fact] void should_use_the_reported_total_once() => _result.Usage!.CostUsd.ShouldEqual(new CostUsd(0.123456m));
    [Fact] void should_count_cached_input_once() => _result.Usage!.CachedTokens.ShouldEqual(new CachedTokens(60));
}
#endif
