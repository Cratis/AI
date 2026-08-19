// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Workers.for_WorkerSecrets.when_rendering;

public class and_values_are_ordinary : Specification
{
    string _result;

    void Because() => _result = WorkerSecrets.Render(new Dictionary<string, string>
    {
        ["CLAUDE_CODE_OAUTH_TOKEN"] = "sk-ant-token",
        ["GITHUB_TOKEN"] = "ghs-token"
    });

    [Fact] void should_assign_the_first_credential() => _result.ShouldContain("CLAUDE_CODE_OAUTH_TOKEN='sk-ant-token'\n");
    [Fact] void should_assign_the_second_credential() => _result.ShouldContain("GITHUB_TOKEN='ghs-token'\n");
}
#endif
