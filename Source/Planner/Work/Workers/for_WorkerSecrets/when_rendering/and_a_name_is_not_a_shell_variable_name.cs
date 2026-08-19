// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Workers.for_WorkerSecrets.when_rendering;

/// <summary>
/// Names are not quoted by the assignment, so an unusable name is refused rather than written into
/// a file the shell will source.
/// </summary>
public class and_a_name_is_not_a_shell_variable_name : Specification
{
    Exception _result;

    void Because() => _result = Cratis.Specifications.Catch.Exception(() => WorkerSecrets.Render(new Dictionary<string, string>
    {
        ["GITHUB_TOKEN; rm -rf /"] = "value"
    }));

    [Fact] void should_refuse_to_render_it() => _result.ShouldBeOfExactType<InvalidWorkerSecretName>();
}
#endif
