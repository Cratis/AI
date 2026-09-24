// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeResponse.when_reading_reported_cost;

public class and_the_cost_is_zero : Specification
{
    LanguageModelResult _result;

    void Because()
    {
        const string envelope = """
        {"is_error":false,"subtype":"success","result":"answer","total_cost_usd":0,"usage":{"input_tokens":3,"output_tokens":5}}
        """;
        _result = ClaudeCodeResponse.Read(new(0, envelope), "model");
    }

    [Fact] void should_distinguish_real_zero_from_unknown() => _result.Usage!.CostUsd.ShouldEqual(new CostUsd(0m));
}
#endif
