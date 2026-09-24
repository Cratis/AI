// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeCompletion;

public class when_running_an_analysis : Specification
{
    ProcessStartInfo _startInfo = null!;
    LanguageModelResult _result = null!;
    ClaudeCodeCompletion _completion = null!;

    void Establish()
    {
        var process = Substitute.For<IClaudeCodeProcess>();
        process.Run(Arg.Any<ProcessStartInfo>(), "Analyze this", CancellationToken.None).Returns(call =>
        {
            _startInfo = call.Arg<ProcessStartInfo>();
            return new ClaudeCodeOutput(0, "{\"is_error\":false,\"subtype\":\"success\",\"result\":\"Analyzed\"}");
        });
        _completion = new(process);
    }

    async Task Because() => _result = await _completion.Complete("Analyze this", " sk-ant-oat- token ", "claude-sonnet-4-6", Effort.High, CancellationToken.None);

    [Fact] void should_complete() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_remove_pasted_whitespace() => _startInfo.Environment["CLAUDE_CODE_OAUTH_TOKEN"].ShouldEqual("sk-ant-oat-token");
    [Fact] void should_keep_the_credential_out_of_arguments() => _startInfo.ArgumentList.Any(value => value.Contains("sk-ant-oat", StringComparison.Ordinal)).ShouldBeFalse();
    [Fact] void should_keep_the_prompt_out_of_arguments() => _startInfo.ArgumentList.ShouldNotContain("Analyze this");
    [Fact] void should_disable_tools() => _startInfo.ArgumentList[_startInfo.ArgumentList.IndexOf("--tools") + 1].ShouldEqual(string.Empty);
    [Fact] void should_disable_external_mcp_servers() => _startInfo.ArgumentList.ShouldContain("--strict-mcp-config");
    [Fact] void should_disable_hooks() => _startInfo.ArgumentList.ShouldContain("{\"disableAllHooks\":true}");
    [Fact] void should_not_inherit_host_secrets() => _startInfo.Environment.Keys.Except(["PATH", "HOME", "CLAUDE_CONFIG_DIR", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]).ShouldBeEmpty();
    [Fact] void should_remove_the_temporary_home() => Directory.Exists(_startInfo.WorkingDirectory).ShouldBeFalse();

    void Destroy() => _completion.Dispose();
}
