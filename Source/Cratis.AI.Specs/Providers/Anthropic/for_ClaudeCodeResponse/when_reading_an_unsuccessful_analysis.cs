// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeResponse;

public class when_reading_an_unsuccessful_analysis : Specification
{
    [Theory]
    [InlineData(1, "{\"is_error\":false,\"subtype\":\"success\",\"result\":\"partial\"}")]
    [InlineData(0, "{\"is_error\":true,\"subtype\":\"success\",\"result\":\"partial\"}")]
    [InlineData(0, "{\"is_error\":false,\"subtype\":\"error_max_turns\",\"result\":\"partial\"}")]
    [InlineData(0, "{\"subtype\":\"success\",\"result\":\"partial\"}")]
    [InlineData(0, "{\"is_error\":false,\"subtype\":\"success\",\"result\":\" \"}")]
    [InlineData(0, "not JSON")]
    [InlineData(0, "[]")]
    void should_not_report_success(int exitCode, string envelope) =>
        ClaudeCodeResponse.Read(new(exitCode, envelope), "claude-sonnet-4-6").Succeeded.ShouldBeFalse();
}
