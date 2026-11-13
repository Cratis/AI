// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_hidden_segments : Specification
{
    [Theory]
    [InlineData(".agent-memory/x.git")]
    [InlineData("a/.hidden/x.git")]
    void should_refuse_the_path(string path) =>
        WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [path]), out _).ShouldBeFalse();
}
