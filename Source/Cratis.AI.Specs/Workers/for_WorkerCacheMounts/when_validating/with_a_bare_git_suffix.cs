// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_a_bare_git_suffix : Specification
{
    [Theory]
    [InlineData("a/.git")]
    [InlineData(".git")]
    void should_refuse_the_path(string path) =>
        WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [path]), out _).ShouldBeFalse();
}
