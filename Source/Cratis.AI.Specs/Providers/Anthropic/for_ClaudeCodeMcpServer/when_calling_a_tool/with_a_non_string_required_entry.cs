// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_a_non_string_required_entry : given.a_server_with_a_malformed_required_list
{
    protected override string Required => "[42]";

    async Task Because() => await CallTool();

    [Fact] void should_return_http_success_with_arguments() => _withArgumentsStatus.ShouldEqual(HttpStatusCode.OK);
    [Fact] void should_return_http_success_without_arguments() => _withoutArgumentsStatus.ShouldEqual(HttpStatusCode.OK);
    [Fact] void should_reject_supplied_arguments_as_invalid_params() => _withArguments.GetProperty("error").GetProperty("code").GetInt32().ShouldEqual(-32602);
    [Fact] void should_reject_missing_arguments_as_invalid_params() => _withoutArguments.GetProperty("error").GetProperty("code").GetInt32().ShouldEqual(-32602);
    [Fact] void should_not_invoke_the_tool() => _invoked.ShouldBeFalse();
}
